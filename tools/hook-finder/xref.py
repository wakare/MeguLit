# finds rip-relative references (lea/mov) to the given RVAs in .text of the image dump and prints a few instructions around them
import sys, os, struct
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pylib'))
import capstone
img = open(sys.argv[1], 'rb').read(); targets = [int(x, 16) for x in sys.argv[2:]]
text_start, text_end = 0x1000, 0x1000 + 0x228518
hits = {t: [] for t in targets}
# brute force: any 7-byte lea/mov reg,[rip+disp32] (48/4c 8d/8b xx with modrm mod=00 rm=101)
for i in range(text_start, text_end - 7):
    b0, b1, b2 = img[i], img[i + 1], img[i + 2]
    if b0 in (0x48, 0x4c) and b1 in (0x8d, 0x8b) and (b2 & 0xc7) == 0x05:
        disp = struct.unpack_from('<i', img, i + 3)[0]; t = i + 7 + disp
        if t in hits: hits[t].append(i)
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
for t, refs in hits.items():
    print(f'== {t:x}: {len(refs)} refs')
    for r in refs[:6]:
        for ins in md.disasm(img[r - 24:r + 40], r - 24):
            if ins.address >= r - 16: print(f'   {ins.address:8x}: {ins.mnemonic} {ins.op_str}')
        print('   --')
