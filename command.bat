@echo off
rem julius_db_dump - creates local db. v0.9
cls

rem changes working directory to that, from that, where executable file is
cd /d %~dp0
set conf=conf

rem includes config file (rename it to bat file, because it is easier to read for this executable file)
if exist %conf%.txt (
	ren %conf%.txt %conf%.bat
)
if exist %conf%.bat (
	call %conf%.bat
) else (
	echo ERROR = There is no configuration file
	goto :eol
)

rem initialization of variables
set import=-console -novid
set file=-console -novid
set remote_dir=/var/lib/jenkins/jobs/julius_tip/workspace/
set remote_path_users=%remote_dir%users.txt
set file=dump
set remote_path=%remote_dir%%file%.gz
set DB=julius
set host=127.0.0.1

rem checks, does pathes in config file exist. If not, prints an error message and exits the script
:check_paths
set checkfail=0
if not exist "%winscp_path%" (
	echo ERROR - please configure WINSCP path&set checkfail=1
)
if not exist "%zip_path%" (
	echo ERROR - please configure ZIP path&set checkfail=1
)
if not exist "%postgre_dir%" (
	echo ERROR - please configure POSTGRE path&set checkfail=1
)
if not exist "%priv_key_path%" (
	echo ERROR - please configure PRIVATE KEY path&set checkfail=1
)
if %checkfail% == 1 goto :eol

rem shows menu. Needed in order to avoid code execution by accident
:import
echo What do you wanna to do?
echo a - import daily dump automatically
echo q - quit
set /p import=? (a / q)
if "%import%"=="a" goto :continue
if "%import%"=="q" goto :eol
goto :import

rem creates output_dir (from config file), if that does not exist
:continue
if not exist "%output_dir%" (
	mkdir "%output_dir%"
)

rem checks are there all needed users in local DB allready created. This is done only, if users.txt file exists in order to skip long downloading time with winscp
set fail=0
set q_check_user=select count(1) from pg_catalog.pg_user where usename = '%%i'
if exist "%output_dir%users.txt" (
	for /f %%i in (%output_dir%users.txt) do (
		"%postgre_dir%psql.exe" -h %host% -U postgres -p %postgre_port% -w -q -c "%q_check_user%" > "%output_dir%tmp"
		for /f "tokens=1 skip=2 " %%a in (%output_dir%tmp) do (
			if %%a == 0 (
				echo ERROR - please make a user "%%i" and then try again
				set fail=1
			)
		)
	)
)
if %fail% == 1 goto :eol

rem connects to server, using winscp and privatekey (from config file). Gets both - compressed db dump and users.txt files
"%winscp_path%" /console /command "option batch off" "option confirm off" "open scp://root@91.123.204.187:65522 -privatekey=""%priv_key_path%""" "get %remote_path% ""%output_dir%""" "get %remote_path_users% ""%output_dir%""" "exit"
echo.
echo Please wait until winscp finished copying files
pause

rem unzips compressed db dump file into output_dir (from config file)
"%zip_path%" x "%output_dir%%file%.gz" -o"%output_dir%"

rem checks are there all needed users in local DB allready created.
set fail=0
set q_check_user=select count(1) from pg_catalog.pg_user where usename = '%%i'
for /f %%i in (%output_dir%users.txt) do (
	"%postgre_dir%psql.exe" -h %host% -U postgres -p %postgre_port% -w -q -c "%q_check_user%" > "%output_dir%tmp"
	for /f "tokens=1 skip=2 " %%a in (%output_dir%tmp) do (
		if %%a == 0 echo ERROR - please make a user "%%i" and then try again& set fail=1
	)
)
if %fail% == 1 goto :eol

rem checks, if db exists. If exists, then recreates it
set q_check_db=select count(1) from pg_catalog.pg_database where datname = '%DB%'
"%postgre_dir%psql.exe" -h %host% -U postgres -p %postgre_port% -w -q -c "%q_check_db%" > "%output_dir%tmp"
for /f "tokens=1 skip=2 " %%a in (%output_dir%tmp) do (
	if %%a == 1 "%postgre_dir%dropdb.exe" -h %host% -U postgres -p %postgre_port% -w %DB%
)
"%postgre_dir%createdb.exe" -h %host% -U postgres -p %postgre_port% -w -E UTF-8 %DB%

rem import all dump info (schema, tables, data) from uncompressed db dump file into newly created local db
"%postgre_dir%psql.exe" -h %host% -U postgres -p %postgre_port% -w -q -d %DB% -f %output_dir%%file%.sql

rem end of the script
:EOL

rem renames config bat file into config txt file, if bat file exists
if exist %conf%.bat (
	ren conf.bat conf.txt
)

rem deletes uncompressed db and temporaly files
if exist "%output_dir%%file%.sql" (del "%output_dir%%file%.sql")
if exist "%output_dir%tmp" (del "%output_dir%tmp")
pause
