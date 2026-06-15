import re

with open(r"C:\Users\DSN\Documents\metaguildx 2\apps\web\src\App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

def fix_mojibake(s):
    try:
        return s.encode("latin-1").decode("utf-8")
    except:
        return None

pattern = re.compile(r"[\xc3][\x80-\xff\u0100-\uffff]+")
fixed_count = 0

def replacer(m):
    global fixed_count
    orig = m.group()
    result = fix_mojibake(orig)
    if result and result != orig:
        fixed_count += 1
        return result
    return orig

content = pattern.sub(replacer, content)
print(f"Fixed: {fixed_count}")

remaining = pattern.findall(content)
print(f"Remaining: {len(remaining)}")
for r in set(remaining[:5]):
    print(repr(r))

with open(r"C:\Users\DSN\Documents\metaguildx 2\apps\web\src\App.tsx", "w", encoding="utf-8") as f:
    f.write(content)