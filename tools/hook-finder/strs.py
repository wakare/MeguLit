# prints ASCII identifiers in the image dump matching a regex, with their RVA
import sys, re
img = open(sys.argv[1], 'rb').read(); pat = re.compile(sys.argv[2].encode(), re.I)
for m in re.finditer(rb'[A-Za-z_][A-Za-z0-9_:]{3,60}\x00', img):
    s = m.group()[:-1]
    if pat.search(s): print(f'{m.start():x} {s.decode()}')
