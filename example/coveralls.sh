#!/bin/bash

echo "repo_token: ${COVERALLS_REPO_TOKEN}" > ./.coveralls.yml
# docker-compose run --rm micromono make docker-coveralls
cat ./coverage/lcov.info | coveralls
