"""Original, code-drawn house icon. No third-party assets or fonts."""
import struct, zlib
from pathlib import Path
def make(name,size,bg,adaptive=False):
    rows=[]
    for y in range(size):
        row=bytearray()
        for x in range(size):
            a,b=x/size,y/size
            house=(.28<a<.72 and .43<b<.75) or (.22<a<.78 and .24<b<.48 and abs(a-.5)<(b-.24)*1.25)
            door=.46<a<.55 and .57<b<.76
            win=(.33<a<.4 or .6<a<.67) and .51<b<.6
            color=(255,255,255,255) if house and not door and not win else bg
            row.extend(color)
        rows.append(b'\x00'+bytes(row))
    def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
    Path('assets',name).write_bytes(png)
Path('assets').mkdir(exist_ok=True)
make('icon.png',1024,(23,107,83,255))
make('adaptive-icon.png',1024,(23,107,83,0),True)
make('splash.png',512,(23,107,83,255))
