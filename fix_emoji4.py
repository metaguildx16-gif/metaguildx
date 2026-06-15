with open(r"C:\Users\DSN\Documents\metaguildx 2\apps\web\src\App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

def h(hex_str):
    return bytes.fromhex(hex_str).decode("utf-8")

mappings = [
    (h("c383c2a2c385e2809cc3a2e282acc593"), ""),
    (h("c383c692c3a2e282ace2809d"), ""),
    (h("c383c2b0c385c2b8c385e28099c382c290"), ""),
    (h("c383c2a2c3a2e2809ac2acc3a2e282acc593"), ""),
    (h("c383c2a2c385e2809cc3a2e282acc2a2"), ""),
    (h("c383c2a2c382c2acc3a2e282acc2a0c383c2afc382c2b8c382c28f"), ""),
    (h("c383c2a2c3a2e2809ec2a2c382c2bbc383c2afc382c2b8c382c28f"), ""),
    (h("c383c2b0c385c2b8c3a2e282accb9cc382c2a5"), ""),
    (h("c383c2b0c385c2b8c3a2e282acc29dc382c28d"), ""),
    (h("c383c2a2c385c2a1c3a2e2809ec2a2c383c2afc382c2b8c382c28f"), ""),
    (h("c383c2b0c385c2b8c3a2e282acc29dc3a2e282ace2809d"), ""),
    (h("c383c2b0c385c2b8c382c28fc3a2e282ace2809dc383c2afc382c2b8c382c28f"), ""),
    (h("c383c2b0c385c2b8c382c2aac3a2e2809ec2a2"), ""),
    (h("c383c2b0c385c2b8c3a2e282ace2809cc382c2bcc383c2afc382c2b8c382c28f"), ""),
    (h("c383c2a2c385e2809cc382c2a6"), ""),
    (h("c383e2809ac382c2a9"), ""),
    (h("c383c2b0c382c29dc3a2e282acc2a2c382c28f"), ""),
    (h("c383c2a2c38bc593c382c2b0"), ""),
    (h("c383c2b0c385c2b8c3a2e282ace284a2c382c2b0"), ""),
    (h("c383c2b0c385c2b8c3a2e282accb9cc3a2e282acc2ba"), ""),
]

fixed = 0
for old, new in mappings:
    count = content.count(old)
    if count:
        content = content.replace(old, new)
        print(str(count) + "x: " + repr(old[:20]) + " -> " + new)
        fixed += count

import re
remaining = re.findall(r"[\xc3][\x80-\xff\u0100-\uffff]+", content)
print("Remaining: " + str(len(remaining)))

with open(r"C:\Users\DSN\Documents\metaguildx 2\apps\web\src\App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")