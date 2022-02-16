#!/bin/bash

################
# folder name ----> ./dump
################

# Show env vars
#grep -v '^#' .env

# Export env vars
export $(grep -v '^#' .env | xargs)

# Restore
docker cp ./dump mongo_mongo_1:/dump
docker exec -it mongo_mongo_1 mongorestore -u=$MONGO_INITDB_ROOT_USERNAME -p=$MONGO_INITDB_ROOT_PASSWORD /dump
docker exec -it mongo_mongo_1 rm -r /dump

exit 0
