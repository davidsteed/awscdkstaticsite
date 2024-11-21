SHELL=/bin/bash
AWS_VERSION := $(shell aws --version 2>/dev/null | cut -d/ -f2 | cut -d. -f1)

check-installed:
	@for exec in $(EXECUTABLES); do \
		if ! which $$exec >/dev/null; then \
			echo "$$exec is not installed"; \
			exit 1; \
		fi; \
	done

init: check-installed
	pre-commit autoupdate
	pre-commit install
	pre-commit install --hook-type commit-msg

aws-version-check:
	@if [ $(AWS_VERSION) -lt 2 ]; then \
		echo "AWS CLI version 2 is required. Please upgrade your AWS CLI."; \
		exit 1; \
	fi

.PHONY: clean
clean:
	rm -rf ./react-site/build
	rm -rf ./react-site/node_modules
	rm -rf ./cdk/node_modules

.PHONY: install
install:
	cd react-site && yarn && cd ..
	cd cdk && yarn  && cd ..

.PHONY: build
build:
	cd react-site && yarn build && cd ..
	cd cdk && yarn build && cd ..

.PHONY: lint
lint:
	golangci-lint run ./... --fix
