with open(r"C:\Users\DSN\Documents\metaguildx 2\apps\web\src\App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Map corrupt sequences to correct emoji using hex identification
mappings = []

import re
pattern = re.compile(r"[\xc3][\x80-\xff\u0100-\uffff]+")
found = {}
for m in pattern.finditer(content):
    s = m.group()
    if s not in found:
        found[s] = s.encode("utf-8").hex()

for s, h in found.items():
    try:
        fixed = bytes.fromhex(h).decode("utf-8").encode("latin-1").decode("utf-8")
        if fixed != s:
            mappings.append((s, fixed))
    except:
        pass

print(f"Mappings found: {len(mappings)}")
for old, new in mappings[:10]:
    print(f"  {repr(old)} -> {repr(new)}")

for old, new in mappings:
    content = content.replace(old, new)

# Manual fixes for known sequences
manual = {
    "Ã‚Â·": "·",
    "Ã°Å¸â€˜Â¤": "👤",
    "Ã°Å¸â€œË†": "📆",
    "Ã¢â‚¬â€\x9d": "\u2014",
    "Ã°Å¸â€\x9dâ€™": "🔙",
    "Ã¢â€": "→",
    "Ã¢Å¡Â": "⚡",
}
for old, new in manual.items():
    count = content.count(old)
    if count:
        content = content.replace(old, new)
        print(f"Manual fixed {count}x: {repr(old)} -> {new}")

import re
remaining = re.findall(r"[\xc3][\x80-\xff\u0100-\uffff]+", content)
print(f"Remaining: {len(remaining)}")

with open(r"C:\Users\DSN\Documents\metaguildx 2\apps\web\src\App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")