<?php
require APP . DS . 'vendors' . DS . 'Gateway.php';
class Gateway_Dibs extends Gateway
{
    private $_localTransaction = false;
    public function __construct()
    {
        $config = new Zend_Config_Ini(CONFIGS . 'gateway.ini', Configure::read('debug') != 0 ? 'testdibs' : 'dibs');
        $this->config = $config->toArray();
    }
    private function _doTransaction($action, $model)
    {
        if ($action == 'begin') {
            // Get datasource
            $this->ds = $model->getDataSource();
            // Begin DB transaction
            if ($model->transactional && !$this->ds->_transactionStarted) {
                $this->_localTransaction = true;
                $this->ds->begin($this);
            }
        }
        if ($action == 'commit') {
            if ($this->_localTransaction) {
                $this->ds->commit($this);
                $this->_localTransaction = false;
            }
        }
        if ($action == 'rollback') {
            if ($this->_localTransaction) {
                $this->ds->rollback($this);
                $this->_localTransaction = false;
            }
        }
    }
    public function activate($orderNo, $deliveryNo)
    {
        App::import('Model', 'Payment');
        $paymentModel = new Payment();
        $this->_doTransaction('begin', $paymentModel);
        $errors = false;
        // Validate order number
        if (!preg_match('/^[0-9]+$/', $orderNo)) {
            $errors = 'Invalid order number';
        }
        if (!$errors) {
            $action = 'activate';
            $data = $this->getData($orderNo, $action, $deliveryNo);
            if ($data['success']) {
                $oldPayment = $data['payment'];
                // XXX TO-DO
                $status = 0;
                $result['0'] = 'TEST-CASE ERROR';
                $result['1'] = 'TEST-123456789-TEST';
                if ($status == 0) {
                    $activationNo = iconv('ISO-8859-1', 'UTF-8', $result['1']);
                    // Update old payment
                    $saveData = array(
                        'id' => $oldPayment['id'],
                        'gateway_status' => 4
                    );
                    $paymentModel->set($saveData);
                    if ($paymentModel->saveRecord($paymentModel->data)) {
                        $paymentModel = new Payment();
                        $saveData = $oldPayment;
                        unset($saveData['id']);
                        $saveData['type'] = 1001;
                        $saveData['trans_no'] = $activationNo;
                        $saveData['gateway_invoice_no'] = $activationNo;
                        $saveData['gateway_status'] = 2;
                        $saveData['activation_date'] = date('Y-m-d H:m:s');
                        $saveData['amount'] = $oldPayment['amount'];
                        $saveData['is_active'] = 'f';
                        $paymentModel->set($saveData);
                        if (!$paymentModel->saveRecord($paymentModel->data)) {
                            $errors = 'Could not create activation payment';
                        }
                    } else {
                        $errors = 'Could not update old reservation payment';
                    }
                } else {
                    $errors = 'Dibs error : ' . $result['0'];
                }
            } else {
                $errors = $data['error'];
            }
        }
        $out = array('success' => false);
        if ($errors) {
            $out['error'] = $errors;
            $this->_doTransaction('rollback', $paymentModel);
        } else {
            $out['success'] = true;
            $this->_doTransaction('commit', $paymentModel);
        }
        return $out;
    }
    private function _activateDibsOrder($orderNo, $reservationNo, $amount)
    {
        $wsdl = $this->config['gateway']['dibs']['wsdl'];
        $strKey = $this->config['gateway']['dibs']['key'];
        $soapCall['shopName'] = $this->config['gateway']['dibs']['shopName'];
        $soapCall['userName'] = $this->config['gateway']['dibs']['userName'];
        $soapCall['password'] = $this->config['gateway']['dibs']['password'];
        $soapCall['verifyID'] = $reservationNo;
        $soapCall['amount'] = $amount;
        $soapCall['extra'] = '&MAC=' . sha1($reservationNo . '&' . $amount . '&' . $strKey . '&');
        $options = array(
            'exceptions' => true,
            'trace' => 1,
            'cache_wsdl' => WSDL_CACHE_NONE
        );
        try {
            $client = new SoapClient($wsdl, $options);
            print_r($soapCall);
            $response = $client->__soapCall('settle', array('parameters' => $soapCall));
        } catch (Exception $e) {

        }
        if (is_a($response, 'stdClass')) {
            print_r($response);
        }
    }
    public function cancel($orderNo)
    {
        App::import('Model', 'Payment');
        $paymentModel = new Payment();
        $this->_doTransaction('begin', $paymentModel);
        $errors = false;
        // Validate order number
        if (!preg_match('/^[0-9]+$/', $orderNo)) {
            $errors = 'Invalid order number';
        }
        if (!$errors) {
            $action = 'cancel';
            $data = $this->getData($orderNo, $action);
            if ($data['success']) {
                $oldPayment = $data['payment'];
                // Update old payment
                $cancelResult = $paymentModel->cancelKlarnaPayment($oldPayment['id']);
                $saveData = array(
                    'id' => $oldPayment['id'],
                    'cancellation_date' => date('Y-m-d H:m:s'),
                    'gateway_status' => 3,
                    'is_active' => 0
                );
                $paymentModel->set($saveData);
                if (!$paymentModel->saveRecord($paymentModel->data)) {
                    $errors = 'Could not cancel Dibs payment';
                }
                if (!$cancelResult['success']) {
                    $errors = 'Could not cancel Marcus payment';
                }
            } else {
                $errors = $data['error'];
            }
        }
        $out = array('success' => false);
        if ($errors) {
            $out['error'] = $errors;
            $this->_doTransaction('rollback', $paymentModel);
        } else {
            $out['success'] = true;
            $this->_doTransaction('commit', $paymentModel);
        }
        return $out;
    }
    public function getData($orderNo, $action, $deliveryNo = false)
    {
        // Set initial error state
        $errors = false;
        $payment = false;
        if (!preg_match('/^[0-9]+$/', $orderNo)) {
            $errors = 'Invalid order number';
        }
        if (!$errors) {
            App::import('Model', 'Country');
            App::import('Model', 'Currency');
            App::import('Model', 'Customer');
            App::import('Model', 'SaleOrder');
            App::import('Model', 'SaleOrderRow');
            App::import('Model', 'Payment');

            // Action allowed
            if (in_array($action, array('reserve', 'activate', 'cancel'))) {
                // Load order
                if (!$errors) {
                    $soModel = new SaleOrder();
                    $params = array(
                        'conditions' => array('order_no' => $orderNo),
                        'recursive' => -1
                    );
                    // Find order
                    $result = $soModel->find('first', $params);
                    // Order found
                    if (!is_array($result)) {
                        // Simplify result
                        $errors = 'Order could not loaded';
                    } else {
                        $order = $result['SaleOrder'];
                    }
                }
                // Load rows
                if (!$errors) {
                    $sorModel = new SaleOrderRow();
                    $sorModel->getSaleOrderRowsForKlarna($order['order_no']);
                    $rows = $sorModel->getSaleOrderRowsForKlarna($order['order_no'], $deliveryNo);
                    if (!$rows) {
                        $errors = 'Could not load rows';
                    }
                }
                // Load currency
                if (!$errors) {
                    $countryModel = new Country();
                    $currencyID = $countryModel->getCurrencyIdByCountryId($order['invoice_country_id']);
                    if ($currencyID) {
                        $currModel = new Currency();
                        $currency = $currModel->get($currencyID);
                        if (!$currency) {
                            $errors = 'Could not load currency';
                        }
                    } else {
                        $errors = 'Could not load currency ID';
                    }
                }
                // Load customer
                if (!$errors) {
                    $customerModel = new Customer();
                    $customer = $customerModel->getCustomerData($order['customer_id']);
                    if (!$customer) {
                        $errors = 'Could not load customer';
                    }
                }
                // Load payment
                if (!$errors) {
                    if (in_array($action, array('activate', 'cancel'))) {
                        $payment = $this->_getReservationPayment($orderNo);
                        if (!$payment) {
                            if (in_array($action, array('creditInvoice', 'creditPartInvoice'))) {
                                $paymentType = 'activation';
                            } else {
                                $paymentType = 'reservation';
                            }
                            $errors = "Could not load {$paymentType} payment";
                        }
                    }
                }
            } else {
                $errors = 'Invalid action';
            }
        }
        $out = array('success' => false);
        if ($errors) {
            $out['error'] = $errors;
        } else {
            $out['success'] = true;
            $out['order'] = $order;
            $out['rows'] = $rows;
            $out['currency'] = $currency;
            $out['customer'] = $customer;
            if ($payment) {
                $out['payment'] = $payment;
            }
        }
        return $out;
    }
    private function _getReservationPayment($orderNo)
    {
        $paymentModel = new Payment();
        $params = array(
            'joins' => array(
                array(
                    'table' => 'sale_orders',
                    'alias' => 'SaleOrder',
                    'type' => 'LEFT',
                    'conditions' => array(
                        'Payment.sale_order_id = SaleOrder.id'
                    )
                ),
            ),
            'conditions' => array(
                'Payment.type' => 1001,
                'Payment.gateway_status' => 0,
                'SaleOrder.order_no' => $orderNo
            ),
            'order' => array('Payment.id DESC'),
            'recursive' => -1
        );

        $payment = $paymentModel->find('first', $params);

        if ($payment) {
            $payment = $payment[$paymentModel->name];
        }
        return $payment;
    }
}
