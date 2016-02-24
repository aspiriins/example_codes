function _(output) {
    console.log(output);
}
var global_TriggeredUsers = 0;
var global_TimechartFrom = 9999999999999999999;
var global_TimechartTo = 0;
var global_TimechartFromNew = 0;
var global_TimechartToNew = 9999999999999999999;
var global_TimechartFromDefault = 1350000000;
var global_TimechartToDefault = 1500000000;
var global_User1_Data;
var global_User2_Data;
var global_User1_Name = "";
var global_User2_Name = "";
//let global_User1_LineColor = "rgba(18,113,145,1)";
var global_User1_LineColor = "rgba(0,153,204,1)";
var global_User1_FillColor = "rgba(0,153,204,1)";
var global_User1_FillColor_timechart = "rgba(0,153,204,0.6)";
var global_User1_FillColor_timechart_dashed = "rgba(0,153,204,0.1)";
//let global_User2_LineColor = "rgba(111,171,91,1)";
var global_User2_LineColor = "rgba(173,209,55,1)";
var global_User2_FillColor = "rgba(173,209,55,1)";
var global_User2_FillColor_timechart = "rgba(173,209,55,0.6)";
var global_User2_FillColor_timechart_dashed = "rgba(173,209,55,0.1)";
var global_WebPage_FillColor = "#2d3639";
var user1 = document.getElementById('user1');
var user2 = document.getElementById('user2');
// setup hash navigation handler and set initial values.
(function () {
    function hashParser(e) {
        var hash = (document.location.hash || "").replace(/^#/, "");
        if (hash.length) {
            var i = hash.indexOf(":");
            if (i === -1) {
                i = hash.length;
            }
            user1.value = hash.substr(0, i);
            user2.value = hash.substr(i + 1);
        }
        if (e) {
            e.preventDefault();
        }
        //return false;
    }
    ;
    // parse the initial values.
    hashParser();
    // if the values were not given in the URL hash, set the defaults
    if (!user1.value && !user2.value) {
        user2.value = "mokori";
    }
    if (!user1.value) {
        user1.value = "seantot";
    }
    document.location.replace("#" + user1.value + ":" + user2.value);
    doSearch();
    // note that hashChange is added after the document.location.replace above.
    window.addEventListener("hashchange", hashParser);
})();
document.getElementById("button_compare_inner").addEventListener("click", function (e) {
    if (window.onhashchange !== void 0) {
        // this will fire onhashchange
        document.location.assign("#" + user1.value + ':' + user2.value);
    }
    doSearch();
    e.preventDefault();
    return false;
});
document.addEventListener("keydown", keyDownTextField, false);
function keyDownTextField(e) {
    var keyCode = e.keyCode;
    if (keyCode == 13) {
        document.location.assign("#" + user1.value + ':' + user2.value);
        doSearch();
    }
}
function doSearch() {
    document.getElementById("loading_image_1").style.display = 'none';
    document.getElementById("loading_image_2").style.display = 'block';
    user1.disabled = true;
    user2.disabled = true;
    _doSearch(user1.value, 1);
    _doSearch(user2.value, 2);
}
function _doSearch(userName, userNo) {
    global_User1_Name = userNo == 1 ? userName : global_User1_Name;
    global_User2_Name = userNo == 2 ? userName : global_User2_Name;
    var xhr = new XMLHttpRequest();
    var url = "api?playerId=tr:" + userName + "&n=1000&offset=0&universe=play&callback=init";
    xhr.open('GET', url, true);
    xhr.send(null);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var data = null;
            data = xhr.responseText.substring(5);
            data = JSON.parse(data.substring(0, data.length - 1));
            if (userNo == 1) {
                global_User1_Data = data;
            }
            else {
                global_User2_Data = data;
            }
            global_TriggeredUsers = global_TriggeredUsers == 1 ? 2 : 1;
            reloadAllCharts();
        }
    };
}
function reloadAllCharts() {
    if (global_TriggeredUsers == 2) {
        if (document.getElementById("piechart_placeholder") != null) {
            document.getElementById("piechart_placeholder").style.display = 'none';
        }
        user1.disabled = false;
        user2.disabled = false;
        document.getElementById("about-zoomcharts").style.display = 'block';
        document.getElementById("loading_image_1").style.display = 'block';
        document.getElementById("loading_image_2").style.display = 'none';
        document.getElementById("container").style.display = 'block';
        var timeChartValues = [];
        var user1MaxWpm = 0;
        var user2MaxWpm = 0;
        var user1MaxWpmStamp = 0;
        var user2MaxWpmStamp = 0;
        if (global_User1_Data && !global_User1_Data.error) {
            for (var i in global_User1_Data) {
                var node = global_User1_Data[i];
                node.wpm = Math.floor(node.wpm);
                if (node.wpm > user1MaxWpm) {
                    user1MaxWpm = node.wpm;
                    user1MaxWpmStamp = node.t;
                }
                timeChartValues.push([node.t, node.wpm, 0, node.wpm]);
            }
        }
        if (global_User2_Data && !global_User2_Data.error) {
            for (var i in global_User2_Data) {
                var node = global_User2_Data[i];
                node.wpm = Math.floor(node.wpm);
                if (node.wpm > user2MaxWpm) {
                    user2MaxWpm = node.wpm;
                    user2MaxWpmStamp = node.t;
                }
                user2MaxWpm = node.wpm > user2MaxWpm ? node.wpm : user2MaxWpm;
                timeChartValues.push([node.t, 0, node.wpm, node.wpm]);
            }
        }
        timeChartValues.sort(function (a, b) { return a[0] - b[0]; });
        if (timeChartValues.length > 0) {
            global_TimechartFrom = timeChartValues[0][0];
            global_TimechartTo = timeChartValues[timeChartValues.length - 1][0] + 1;
        }
        else {
            global_TimechartFrom = global_TimechartFromDefault;
            global_TimechartTo = global_TimechartToDefault;
        }
        global_TimechartFrom = Math.floor(global_TimechartFrom);
        global_TimechartTo = Math.floor(global_TimechartTo);
        var series = [
            {
                name: global_User1_Name,
                type: "line",
                style: {
                    fillColor: global_User1_FillColor_timechart,
                    lineColor: global_User1_LineColor,
                    smoothing: true,
                    lineWidth: 2,
                    marker: {
                        shape: "circle"
                    }
                },
                data: {
                    index: 1,
                    aggregation: 'max',
                    noDataPolicy: 'skip',
                    aggregatedValueFunction: function (value, time) {
                        return value == 0 ? null : value;
                    }
                }
            },
            {
                name: global_User1_Name,
                type: "line",
                style: {
                    fillColor: global_User1_FillColor_timechart_dashed,
                    lineColor: global_User1_LineColor,
                    //lineDash: [3, 10],
                    smoothing: true,
                    lineWidth: 2
                },
                data: {
                    index: 1,
                    aggregation: 'max',
                    aggregatedValueFunction: function (value, time) {
                        return value == 0 ? null : value;
                    }
                },
                showInLegend: false
            }
        ];
        if (global_User2_Name != "") {
            var params = {
                name: global_User2_Name,
                type: "line",
                style: {
                    fillColor: global_User2_FillColor_timechart,
                    lineColor: global_User2_LineColor,
                    smoothing: true,
                    lineWidth: 2,
                    marker: {
                        shape: "circle"
                    }
                },
                data: {
                    index: 2,
                    aggregation: 'max',
                    noDataPolicy: 'skip',
                    aggregatedValueFunction: function (value, time) {
                        return value == 0 ? null : value;
                    }
                }
            };
            series.push(params);
            params = {
                name: global_User2_Name,
                type: "line",
                style: {
                    fillColor: global_User2_FillColor_timechart_dashed,
                    lineColor: global_User2_LineColor,
                    //lineDash: [3, 10],
                    smoothing: true,
                    lineWidth: 2
                },
                data: {
                    index: 2,
                    aggregation: 'max',
                    aggregatedValueFunction: function (value, time) {
                        return value == 0 ? null : value;
                    }
                },
                showInLegend: false
            };
            series.push(params);
        }
        var timeChart = new TimeChart({
            container: "timechart",
            area: {
                height: 350,
                style: {
                    fillColor: global_WebPage_FillColor
                }
            },
            data: [{
                    timestampInSeconds: true,
                    preloaded: {
                        from: global_TimechartFrom,
                        to: global_TimechartTo,
                        dataLimitFrom: global_TimechartFrom,
                        dataLimitTo: global_TimechartTo,
                        unit: "s",
                        values: timeChartValues
                    }
                }],
            series: series,
            milestones: [
                {
                    align: "center",
                    label: {
                        text: "<b>" + user1MaxWpm + "<br></b>wpm",
                        backgroundStyle: {
                            fillColor: "rgba(0,0,0,0)",
                            lineColor: "rgba(0,0,0,0)"
                        },
                        textStyle: {
                            font: "24px Arial",
                            fillColor: global_User1_FillColor
                        },
                        margin: -10
                    },
                    style: {
                        lineColor: "white",
                        lineWidth: 2
                    },
                    time: Math.floor(user1MaxWpmStamp) * 1000
                },
                {
                    align: "center",
                    label: {
                        text: "<b>" + user2MaxWpm + "<br></b>wpm",
                        backgroundStyle: {
                            fillColor: "rgba(0,0,0,0)",
                            lineColor: "rgba(0,0,0,0)"
                        },
                        margin: -10,
                        textStyle: {
                            font: "24px Arial",
                            fillColor: global_User2_FillColor
                        }
                    },
                    style: {
                        lineColor: "white",
                        lineWidth: 2
                    },
                    time: Math.floor(user2MaxWpmStamp) * 1000
                }
            ],
            valueAxisDefault: { enabled: false },
            toolbar: {
                items: [
                    { item: 'zoomOut' }
                ]
            },
            legend: {
                enabled: true,
                text: {
                    fillColor: "#FFFFFF"
                }
            },
            info: { showNoData: false },
            navigation: {
                initialDisplayUnit: "1 M",
                initialDisplayPeriod: global_TimechartFrom * 1000 + " > " + global_TimechartTo * 1000
            },
            interaction: {
                resizing: { enabled: false }
            },
            currentTime: { enabled: false },
            advanced: {
                themeCSSClass: "DVSL-flat DVSL-dark",
                assets: []
            },
            timeAxis: {
                style: {
                    majorTimeLabel: {
                        fillColor: "#FFFFFF"
                    },
                    minorTimeLabel: {
                        fillColor: "#FFFFFF"
                    },
                },
                maxUnitWidth: 400,
                minUnitWidth: 40,
                showHolidays: false
            },
            events: {
                onAnimationDone: function (event, args) {
                    if (args.origin != 'init') {
                        global_TimechartFromNew = args.timeStart;
                        global_TimechartToNew = args.timeEnd;
                        facetChartInit();
                    }
                }
            }
        });
        var pieChartValues = [
            { "value": user2MaxWpm, style: { fillColor: global_User2_LineColor } },
            { "value": user1MaxWpm, style: { fillColor: global_User1_FillColor } }
        ];
        var pieChart = new PieChart({
            container: "piechart",
            data: [{
                    preloaded: {
                        subvalues: pieChartValues
                    }
                }],
            legend: { enabled: false },
            labels: { enabled: false },
            pie: { innerRadius: 0.6 },
            interaction: { selection: { enabled: false }, resizing: { enabled: false } },
            info: {
                contentsFunction: function (data, slice) {
                    return slice.value + " wpm";
                }
            }
        });
        timeChartValues.sort(function (a, b) { return b[3] - a[3]; });
        function facetChartInit() {
            var facetChartValues = [];
            var counter = 0;
            for (var i in timeChartValues) {
                if (timeChartValues[i][0] * 1000 >= global_TimechartFromNew && timeChartValues[i][0] * 1000 <= global_TimechartToNew) {
                    var fillColor = global_User2_FillColor;
                    var userName = global_User2_Name;
                    if (timeChartValues[i][1] > 0) {
                        fillColor = global_User1_FillColor;
                        userName = global_User1_Name;
                    }
                    var node = {
                        name: timeChartValues[i][3] + " WPM",
                        value: timeChartValues[i][3],
                        fillColor: fillColor,
                        userName: userName
                    };
                    facetChartValues.push(node);
                    counter++;
                }
                if (counter == 1000) {
                    break;
                }
            }
            var facetChart = new FacetChart({
                container: "facetchart",
                data: [{
                        preloaded: {
                            subvalues: facetChartValues,
                            dataLimitFrom: global_TimechartFrom,
                            dataLimitTo: global_TimechartTo
                        }
                    }],
                series: [
                    {
                        data: {
                            field: "value"
                        },
                        style: {
                            padding: [12, 12]
                        },
                        valueLabels: {
                            enabled: true,
                            contentsFunction: function (value) {
                                var content = (value === (value | 0)) ? value.toString() : value.toFixed(2);
                                return "<b>" + content + "<br></b>WPM";
                            }
                        }
                    }
                ],
                valueAxisDefault: {
                    enabled: false
                },
                toolbar: { enabled: false },
                area: {
                    style: {
                        fillColor: global_WebPage_FillColor
                    }
                },
                items: {
                    styleFunction: function (item, itemData) {
                        item.values[0].style.fillColor = itemData.fillColor;
                        item.values[0].style.gradient = 1;
                    }
                },
                facetAxis: {
                    //enabled: false,
                    defaultUnitWidth: 110,
                    labels: {
                        textStyle: {
                            fillColor: "#FFFFFF",
                            font: "18px Arial"
                        }
                    }
                },
                info: {
                    advanced: {
                        contentsFunction: function (data, series, range) {
                            var node = facetChartValues[range[0]];
                            return '<table><tr><td><font style="color:' + node.fillColor + ';">' + node.name + ' = ' + node.userName + '</font></td></tr></table>';
                        },
                        showHeader: false
                    }
                },
                interaction: {
                    resizing: { enabled: false }
                },
                advanced: {
                    themeCSSClass: "DVSL-flat DVSL-dark",
                    assets: []
                }
            });
        }
        facetChartInit();
    }
}
//# sourceMappingURL=js.js.map