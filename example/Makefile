NPM := npm --loglevel warn
JSPM_INSTALL := /opt/node_modules/.bin/jspm i -y
SERVICES = account balancer home io test


sink:
	- docker rm -f `docker ps -qa`

clean:
	@for file in * .* ; do\
		if [ -d "./$$file/node_modules" ]; then\
			dir=./$$file/node_modules;\
			echo "remove $$dir";\
			rm -rf $$dir; \
		fi;\
		if [ -d "./$$file/public/jspm_packages" ]; then\
			dir=./$$file/public/jspm_packages;\
			echo "remove $$dir";\
			rm -rf $$dir; \
		fi;\
		if [ -f "./$$file/public/config.js" ]; then\
			dir=./$$file/public/config.js;\
			echo "remove $$dir";\
			rm -rf $$dir; \
		fi;\
	done

install:
	docker-compose run --rm installation make docker-install

docker-install:
	cd /opt && $(NPM) i
	cd /opt/micromono && $(NPM) i
	cd /opt/home/ && $(JSPM_INSTALL)
	cd /opt/io/ && $(JSPM_INSTALL)
	cd /opt/balancer/ && $(JSPM_INSTALL)
	cd /opt/channel/ && $(JSPM_INSTALL)

mono:
	DEBUG=micromono* node server/server.js --service-dir ./ --service account,home

mono-io:
	DEBUG=micromono* node server/server.js --service-dir ./ --service io

cluster:
	docker-compose run --publish 3000:3000 --rm balancer

nats-cluster:
	docker-compose run --publish 3000:3000 --rm balancer-nats


e2e:
	docker-compose up -d chromedebug
	sleep 60
	open vnc://test:secret@`docker-machine ip default`:5900
	docker-compose run --rm nightwatch --config ./nightwatch.json -e default

e2e-ci:
	docker-compose up -d chrome
	sleep 60
	docker-compose logs &
	docker-compose run --rm nightwatch --config ./nightwatch.json -e default

report:
	docker-compose run --rm micromono istanbul report

coveralls:
	ls -al /opt/micromono
	chmod +x ./coveralls.sh
	./coveralls.sh

docker-coveralls:
	cat ./coverage/lcov.info | coveralls
