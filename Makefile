.PHONY: test


test: clean
	deno lint
	deno test --allow-all --reload --coverage=coverage

cover:
	deno coverage ./coverage --lcov > ./coverage/out.lcov
	genhtml -o ./coverage/html ./coverage/out.lcov
	open ./coverage/html/index.html

clean:
	rm -rf ./coverage

fmt:
	deno fmt src/ tests/

