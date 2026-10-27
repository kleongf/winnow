"""Print the API's OpenAPI schema; the frontend's types are generated from it."""

import json
import sys

from winnow.app import create_app


def main() -> None:
    sys.stdout.write(json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
