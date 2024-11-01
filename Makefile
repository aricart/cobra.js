.PHONY: test


test: clean
	deno lint --unstable
	deno test --allow-all --unstable --reload --coverage=coverage

cover:
	deno coverage --unstable ./coverage --lcov > ./coverage/out.lcov
	genhtml -o ./coverage/html ./coverage/out.lcov
	open ./coverage/html/index.html

clean:
	rm -rf ./coverage

fmt:
	deno fmt src/ tests/

