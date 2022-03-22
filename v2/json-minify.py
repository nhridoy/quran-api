# 1st Method: Minify JSON
# import re
# import os
# import json
# filename = 'v2/quran.json'  # file name we want to compress
# newname = 'quran.min.json'  # Output file name
# fp = open(filename, encoding="utf8")
# print("Compressing file: " + filename)
# print('Compressing...')

# jload = json.load(fp)
# newfile = json.dumps(jload, indent=None, separators=(',', ':'))
# newfile = str.encode(newfile).decode('unicode_escape')
# f = open(newname, 'wb')
# f.write(newfile.encode('utf-8'))
# f.close()
# print('Compression complete! Type quit to exit IPython')

# 2nd Method: Minify JSON
import json
filename = 'v2/quran.json'  # file name we want to compress
newname = 'quran.min.json'  # Output file name
read_file = open(filename, encoding="utf8")
print("Compressing file: " + filename)
print('Compressing...')
data = json.load(read_file)
read_file.close()
write_file = open(newname, 'w', encoding="utf8")
newfile = json.dump(data, indent=None, separators=(',', ':'))
newfile = str.encode(newfile).decode('unicode_escape')
write_file.write(newfile.encode('utf-8'))
write_file.close()
print('Done!')
print('Compressed file name:', newname)
print('Original file size:', len(open(filename, 'r', encoding="utf8").read()))
print('Compressed file size:', len(open(newname, 'r', encoding="utf8").read()))
print('Compression ratio:', len(open(newname, 'r', encoding="utf8").read()
                                )/len(open(filename, 'r', encoding="utf8").read()))


# import re
# import os
# # cwd = os.getcwd()  # Get the current working directory (cwd)
# # files = os.listdir(cwd)  # Get all the files in that directory
# # print("Files in %r: %s" % (cwd, files))

# This is a python program to minify a large json file
# The file contains arabic caracters and it is very large
# After minification we need to keep the arabic character


# def minify(filename):
#     with open(filename, 'r', encoding="utf8") as f:
#         data = json.load(f)
#     with open(filename, 'w', encoding="utf8") as f:
#         json.dump(data, f, indent=None)


# def main():
#     cwd = os.getcwd()  # Get the current working directory (cwd)
#     files = os.listdir(cwd)  # Get all the files in that directory
#     print("Files in %r: %s" % (cwd, files))
#     minify('v2/quran.json')
#     # for f in files:
#     #     if f.endswith('.json'):
#     #         minify(f)


# if __name__ == '__main__':
#     main()
