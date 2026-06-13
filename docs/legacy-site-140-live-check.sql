-- Read-only live checks for siteId=140 / B25
-- Generated on 2026-04-09 Asia/Shanghai

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('140btwentyfive', '140', '140_data', '126lnoffice', '126lnoffice_data')
ORDER BY schema_name;

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name LIKE '140%'
   OR schema_name LIKE '%btwentyfive%'
ORDER BY schema_name;

SELECT appid, appName, appexplain, ipaddr, appport, model_ip, model2d_ip, model2d_dataId, template
FROM zsqy_v1.appmanager
WHERE appid = 140;

SELECT appid, appName, appexplain, ipaddr, appport, model_ip, model2d_ip, model2d_dataId, template
FROM zsqy_v1.appmanager
WHERE lower(ifnull(appName, '')) LIKE '%b25%'
   OR lower(ifnull(appexplain, '')) LIKE '%b25%'
   OR lower(ifnull(appexplain, '')) LIKE '%foxconn%'
   OR lower(ifnull(appexplain, '')) LIKE '%guanlan%'
   OR lower(ifnull(model_ip, '')) LIKE '%guanlan%'
   OR lower(ifnull(model2d_ip, '')) LIKE '%guanlan%'
ORDER BY appid;

SELECT *
FROM zsqy_v1.appusergroup
WHERE appid = 140
ORDER BY id;

SHOW CREATE TABLE zsqy_v1.appmanager;
SHOW CREATE TABLE zsqy_v1.appusergroup;
