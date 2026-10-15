@echo off
setlocal
set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot
set PATH=%JAVA_HOME\bin;%PATH%
set ANDROID_HOME=C:\Users\kainm\AppData\Local\Android\Sdk
set ANDROID_SDK_ROOT=C:\Users\kainm\AppData\Local\Android\Sdk
cd /d D:\MAiCORP\MAI-Life-Wars-MVP\android
gradlew.bat assembleRelease
exit %ERRORLEVEL%