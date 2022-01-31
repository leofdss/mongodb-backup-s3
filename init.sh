#!/bin/bash
mkdir -p ./mongo_database
docker-compose -p mongo up -d --build 