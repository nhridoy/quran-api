import sys
import requests
import json
import os
# contents = open('singleSurah.min.json', encoding="utf8")
# load = json.load(contents)
data = requests.get(
    'https://cdn.jsdelivr.net/gh/nhridoy/quran-api@main/v2/singleSurah.min.json').json()

# print(type((load)))

for key in data['singleSurah']:
    surah = data['singleSurah'][key]
    dumping = json.dumps(surah, ensure_ascii=False)
    # print(dumping)
    # break
    newname = f'{key}.min.json'
    new_file_location = os.path.join('./divide/', newname)
    with open(new_file_location, 'w',  encoding="utf8") as write_file:
        # write_file.write(dumping.encode('cp1252', errors='ignore'))

        # newfile = str.encode(str(surah)).decode('unicode_escape')
        write_file.write(dumping)
