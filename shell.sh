#!/bin/bash
# Copy by rsync marcus acl.ini to web02
# /backup/acl_backup.sh

# initialize variables and date
SLAVE=94.246.106.1
BAK=/backup/acl
NOW=$(date +"%u")

# check, if date directory exists, if not - recreates it
[ ! -d $BAK/$NOW ] && mkdir -p $BAK/$NOW || /bin/rm -fr $BAK/$NOW/*
[ ! -d $BAK/$NOW/marcus ] && mkdir -p $BAK/$NOW/marcus || /bin/rm -f $BAK/$NOW/marcus/*
[ ! -d $BAK/$NOW/julius ] && mkdir -p $BAK/$NOW/julius || /bin/rm -f $BAK/$NOW/julius/*

# add 0777 permissions for pg_dump
   chmod ugo+w $BAK/$NOW
   chmod ugo+w $BAK/$NOW/marcus
   chmod ugo+w $BAK/$NOW/julius
cp /var/www/marcus.brandos.com/app/config/acl.ini $BAK/$NOW/marcus/acl.ini
cp /var/www/julius.brandos.com/app/config/acl.ini $BAK/$NOW/julius/acl.ini
# use rsync to copy objects to b04 server(changed to web02)
rsync -avhe "ssh -p 22" --delete --progress $BAK/$NOW/marcus/ root@$SLAVE:$BAK/$NOW/marcus
rsync -avhe "ssh -p 22" --delete --progress $BAK/$NOW/julius/ root@$SLAVE:$BAK/$NOW/julius

# delete created diretory
rm -f -r $BAK
exit


# initialize variables and date
SLAVE=127.0.0.1
BAK=/backup/postgre
NOW=$(date +"%u")

# check, if date directory exists, if not - recreates it
[ ! -d $BAK/$NOW ] && mkdir -p $BAK/$NOW || /bin/rm -f $BAK/$NOW/*

# array of domain names, which will have test environment. Example (marcus julius)
DB_ARRAY=(marcus julius)

for DB in "${DB_ARRAY[@]}"
do
   # add 0777 permissions for pg_dump
   chmod ugo+w $BAK/$NOW
   # dump all db info, archieve that
   su - postgres -c "pg_dump $DB | gzip > $BAK/$NOW/$DB.gz"
done

# use rsync in order to copy all created db objects to b04 server
rsync -avhe "ssh -p 22" --delete --progress $BAK/$NOW/ root@$SLAVE:$BAK/$NOW

# delete created diretory
rm -f -r $BAK
exit

SHELL 2:

MUSER="root"
MPASS=""
MHOST="localhost"
MYSQLDUMP="/usr/bin/mysqldump"
BAK="/backup/mysql/"
GZIP="gzip"
NOW=$(date +"%u")

echo "Running dump. Please wait... "
[ ! -d $BAK$NOW ] && mkdir -p $BAK$NOW || /bin/rm -f $BAK$NOW/*
echo $DBS
DBS="$($MYSQL -Bse 'show databases')"
for db in $DBS
do
 FILE=$BAK$NOW/$db.sql
 echo "SET AUTOCOMMIT=0;" > $FILE
 echo "SET FOREIGN_KEY_CHECKS=0;" >> $FILE
 $MYSQLDUMP --opt -u $MUSER --password="" --single-transaction $db >> $FILE
 echo "SET FOREIGN_KEY_CHECKS=1;" >> $FILE
 echo "COMMIT;" >> $FILE
 echo "SET AUTOCOMMIT=1;"  >> $FILE
 $GZIP -9 $FILE
done
rsync -avhe "ssh -p 22" --delete --progress $BAK$NOW/ root@94.246.106.1:$BAK$NOW
rm -f -r $BAK
echo "Done!"
