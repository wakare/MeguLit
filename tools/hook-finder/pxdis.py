# usage: python -I pxdis.py <image dump> <rva hex> [count] [func|at]  - disassembles a mapped-image dump (RVA = file offset)
import sys, os, struct
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pylib'))
import capstone
img = open(sys.argv[1], 'rb').read(); rva = int(sys.argv[2], 16)
count = int(sys.argv[3]) if len(sys.argv) > 3 else 60
mode = sys.argv[4] if len(sys.argv) > 4 else 'func'
start = rva
if mode == 'func':
    # .pdata RUNTIME_FUNCTION table from the PE header in the dump
    pe = struct.unpack_from('<I', img, 0x3c)[0]; opt = pe + 24
    exc_rva, exc_size = struct.unpack_from('<II', img, opt + 112 + 3 * 8)
    for i in range(0, exc_size, 12):
        s, t, u = struct.unpack_from('<III', img, exc_rva + i)
        if s <= rva < t: start = s; print(f'function {s:x}-{t:x}'); break
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64); md.detail = False
n = 0
for ins in md.disasm(img[start:start + count * 16], start):
    tag = '>>' if ins.address == rva else '  '
    note = ''
    if 'rip +' in ins.op_str or 'rip -' in ins.op_str:
        import re
        m = re.search(r'rip ([+-]) (0x[0-9a-f]+)', ins.op_str)
        if m:
            tgt = ins.address + ins.size + (int(m.group(2), 16) if m.group(1) == '+' else -int(m.group(2), 16))
            if 0 <= tgt < len(img):
                raw = img[tgt:tgt + 48].split(b'\0')[0]
                try: s = raw.decode('utf-8')
                except Exception: s = ''
                if len(s) >= 3 and s.isprintable(): note = f'   ; {tgt:x} "{s}"'
                else: note = f'   ; {tgt:x}'
    print(f'{tag}{ins.address:8x}: {ins.mnemonic:8} {ins.op_str}{note}')
    n += 1
    if n >= count: break
