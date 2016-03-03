install:
	cd account/ && npm i
	cd home/ && npm i
	cd io/ && npm i
	cd server/ && npm i && npm run-script jspm

mono:
	DEBUG=micromono* node server/server.js --service-dir ./ --service account,home

mono-io:
	DEBUG=micromono* node server/server.js --service-dir ./ --service io

cluster:
	docker-compose run --publish 3000:3000 --rm balancer

nats-cluster:
	docker-compose run --publish 3000:3000 --rm balancer-nats
