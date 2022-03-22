import sys
import requests
import json
import os
# contents = open('singleSurah.min.json', encoding="utf8")
# load = json.load(contents)
data = requests.get(
    'https://cdn.jsdelivr.net/gh/nhridoy/quran-api@main/v1/singleSurah.min.json').json()

# print(type((load)))

for key in data['singleSurah']:
    surah = data['singleSurah'][key]
    dumping = str.encode(json.dumps(surah)).decode('unicode_escape')
    # print(dumping)
    # print(type(dumping))
    # break
    # print(type(surah))
    # break
    newname = f'{key}.min.json'
    new_file_location = os.path.join('divide/', newname)
    write_file = open(new_file_location, 'wb')
    write_file.write(dumping.encode('cp1252', errors='ignore'))

    # newfile = str.encode(str(surah)).decode('unicode_escape')
    # write_file.write(newfile)
    # write_file.close()
