import re
with open(r"C:\Users\DSN\Documents\metaguildx 2\apps\web\src\App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

pattern = re.compile(r"[\xc3][\x80-\xff\u0100-\uffff]+")
found = {}
for m in pattern.finditer(content):
    s = m.group()
    found[s] = found.get(s, 0) + 1

for s, count in sorted(found.items(), key=lambda x: -x[1]):
    h = s.encode("utf-8").hex()
    print(str(count) + "x hex=" + h + " repr=" + repr(s))