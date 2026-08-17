import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('"Rp " + ', '')
content = content.replace("'Rp ' + ", '')
content = content.replace('}Rp${', '}${')
content = content.replace(': Rp ${', ': ${')
content = content.replace('replace("Rp", "")', 'replace("", "")')

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done replacing Rp")
