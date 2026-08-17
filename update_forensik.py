import json
import re

data_path = r'c:\Users\User\Documents\Market Share\rbk-market-share\js\data.js'

print("Reading data.js...")
with open(data_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

json_str = js_content.replace('window.marketSimulatorData = ', '').rstrip(';')
data = json.loads(json_str)

service_name = "KEDOKTERAN FORENSIK"
updated_count = 0

for h in data.get('hospitals', []):
    if service_name in h.get('services', {}):
        if "hasan sadikin" in h.get('name', '').lower():
            h['services'][service_name]['competency'] = 4
            updated_count += 1
            print("Updated Hasan Sadikin")

new_js = "window.marketSimulatorData = " + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ";"
with open(data_path, 'w', encoding='utf-8') as f:
    f.write(new_js)

print(f"Updated {updated_count} hospitals.")
