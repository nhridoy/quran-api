import json
filename = 'v2/quran.json'  # file name we want to compress
# by default i have set the new filename to be 'compressed_' + filename
newname = 'quran.min.json'
fp = open(filename, encoding="utf8")
jload = json.load(fp)
newfile = json.dumps(jload, indent=None, separators=(',', ':'))
f = open(newname, 'wb')
f.write(newfile.encode())
f.close()
print('Compression complete! Type quit to exit IPython')
# import os

# cwd = os.getcwd()  # Get the current working directory (cwd)
# files = os.listdir(cwd)  # Get all the files in that directory
# print("Files in %r: %s" % (cwd, files))
