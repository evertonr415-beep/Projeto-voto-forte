from pathlib import Path

path = Path('app/map-contact-layer.tsx')
text = path.read_text(encoding='utf-8')

text = text.replace(
'''          centers = mergeCenters(centers, collectCentersFromMap(map));
          draw();
          updateStatus(false);''',
'''          centers = mergeCenters(centers, collectCentersFromMap(map));
          draw();
          removeLegacyContactPins(map);
          updateStatus(false);''',
1,
)

text = text.replace(
'''          window.setTimeout(() => {
            removeLegacyContactPins(map);
            if (delay === 0) void refresh(true);''',
'''          window.setTimeout(() => {
            if (delay === 0) void refresh(true);''',
1,
)

path.write_text(text, encoding='utf-8')
