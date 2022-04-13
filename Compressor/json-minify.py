# 1st Method: Minify JSON
import re
import os
import json
filename = 'quran.json'  # file name we want to compress


# def minify(filename):
#     newname = filename.replace('.json', '.min.json')  # Output file name
#     new_file_location = os.path.join(
#         './compressed/', newname)  # Output file location
#     fp = open(filename, encoding="utf8")
#     print("Compressing file: " + filename)
#     print('Compressing...')

#     jload = json.load(fp)
#     newfile = json.dumps(jload, indent=None, separators=(
#         ',', ':'), ensure_ascii=False)
#     # newfile = str.encode(newfile)
#     f = open(new_file_location, 'wb')
#     f.write(newfile)
#     f.close()
#     print('Compressed file name:', new_file_location)
#     print('Original file size:', len(open(filename, 'r', encoding="utf8").read()))
#     print('Compressed file size:', len(
#         open(new_file_location, 'r', encoding="utf8").read()))
#     print('Compression ratio:', len(open(new_file_location, 'r', encoding="utf8").read()
#                                     )/len(open(filename, 'r', encoding="utf8").read()))


# 2nd Method: Minify JSON


# def minify(filename):
#     newname = filename.replace('.json', '.min.json')  # Output file name
#     new_file_location = os.path.join(
#         './compressed/', newname)  # Output file location
#     read_file = open(filename, encoding="utf8")
#     print("Compressing file: " + filename)
#     print('Compressing...')
#     data = json.load(read_file)
#     # read_file.close()
#     write_file = open(new_file_location, 'wb')
#     newfile = json.dumps(data, indent=None, separators=(',', ':'), ensure_ascii=False)
#     newfile = str.encode(newfile).decode('unicode_escape')
#     write_file.write(newfile.encode('utf-8'))
#     write_file.close()
#     print('Done!')
#     print('Compressed file name:', newname)
#     print('Original file size:', len(open(filename, 'r', encoding="utf8").read()))
#     print('Compressed file size:', len(
#         open(newname, 'r', encoding="utf8").read()))
#     print('Compression ratio:', len(open(newname, 'r', encoding="utf8").read()
#                                     )/len(open(filename, 'r', encoding="utf8").read()))


# import re
# import os
# # cwd = os.getcwd()  # Get the current working directory (cwd)
# # files = os.listdir(cwd)  # Get all the files in that directory
# # print("Files in %r: %s" % (cwd, files))

# This is a python program to minify a large json file
# The file contains arabic caracters and it is very large
# After minification we need to keep the arabic character

# 3rd Method: Minify JSON


def minify(filename):
    newname = filename.replace('.json', '.min.json')  # Output file name
    new_file_location = os.path.join(
        './compressed/', newname)  # Output file location
    with open(filename, encoding="utf8") as fp:
        print("Compressing file: " + filename)
        print('Compressing...')

        jload = json.load(fp)
        newfile = json.dumps(jload, indent=None, separators=(
            ',', ':'), ensure_ascii=False)
        # newfile = str.encode(newfile) # remove this
    with open(new_file_location, 'w',  encoding="utf8") as f:  # add encoding="utf8"
        f.write(newfile)

    print('Done!')
    print('Compressed file name:', newname)
    print('Original file size:', len(
        open(filename, 'r', encoding="utf8").read()))
    print('Compressed file size:', len(
        open(new_file_location, 'r', encoding="utf8").read()))
    print('Compression ratio:', len(open(new_file_location, 'r', encoding="utf8").read()
                                    )/len(open(filename, 'r', encoding="utf8").read()))


def main():
    cwd = os.getcwd()  # Get the current working directory (cwd)
    files = os.listdir(cwd)  # Get all the files in that directory
    dirName = 'compressed'
    if not os.path.exists(dirName):
        os.mkdir(dirName)
        print("Directory ", dirName,  " Created ")  # Output directory created
    print("Files in %r: %s" % (cwd, files))
    for f in files:
        if f.endswith('.json'):
            minify(f)
    print('Compression complete.')


if __name__ == '__main__':
    main()
