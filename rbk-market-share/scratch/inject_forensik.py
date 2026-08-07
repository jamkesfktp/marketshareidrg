import json
import re

data_path = r'c:\Users\User\Documents\Market Share\rbk-market-share\js\data.js'

print("Reading data.js...")
with open(data_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

# Parse JSON
json_str = js_content.replace('window.marketSimulatorData = ', '').rstrip(';')
data = json.loads(json_str)

service_name = "KEDOKTERAN FORENSIK"

# 1. Add to root services array if not exists
if service_name not in data.get('services', []):
    data['services'].append(service_name)
    data['services'].sort()
    print(f"Added {service_name} to root services array.")

# 2. Add to hospitals
hospitals = data.get('hospitals', [])
updated_count = 0
for h in hospitals:
    if service_name not in h['services']:
        # Set competency to 1 for Moewardi (3372015) so it shows up
        comp = 1 if h['code'] == '3372015' else 0
        h['services'][service_name] = {
            "competency": comp,
            "total": [0.0, 0.0, 0.0],
            "severity": {}
        }
        updated_count += 1
    else:
        # If it somehow exists, ensure Moewardi has competency > 0
        if h['code'] == '3372015' and h['services'][service_name]['competency'] == 0:
            h['services'][service_name]['competency'] = 1
            updated_count += 1

print(f"Injected {service_name} into {updated_count} hospitals.")

# Save back to data.js
new_js = "window.marketSimulatorData = " + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ";"
with open(data_path, 'w', encoding='utf-8') as f:
    f.write(new_js)

print("Saved data.js successfully.")
