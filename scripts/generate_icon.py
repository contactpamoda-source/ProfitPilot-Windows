from PIL import Image, ImageDraw
from pathlib import Path

out = Path("assets")
out.mkdir(exist_ok=True)
size = 512
im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((16, 16, 496, 496), radius=116, fill=(0, 106, 104, 255))
d.rounded_rectangle((34, 34, 478, 478), radius=100, fill=(0, 153, 151, 255))
# Clean white P symbol with rounded loop
d.rounded_rectangle((122, 106, 181, 406), radius=26, fill=(255, 255, 255, 255))
d.rounded_rectangle((150, 106, 366, 304), radius=95, fill=(255, 255, 255, 255))
d.rounded_rectangle((209, 160, 308, 249), radius=43, fill=(0, 153, 151, 255))
# Ascending finance bars in dark teal
for x, y, h in [(234, 365, 48), (282, 339, 74), (330, 314, 99)]:
    d.rounded_rectangle((x, y, x + 28, y + h), radius=9, fill=(0, 81, 82, 255))
im.save(out / "profitpilot-icon.png")
im.save(out / "profitpilot-icon.ico", format="ICO", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("Created assets/profitpilot-icon.ico")
