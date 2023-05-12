#!/bin/sh

jq --argjson orgs '["slashtags", "synonymdev", "holepunchto"]' \
  '.dependencies // {} |
  with_entries(
    select(
      .value |
      startswith("github:")
        and (
          split("/")[0]
          | split(":")[1]
          | IN($orgs[])
          | not
        )
    )
  ) | if . == {} then 0 else error(. | tostring) end' package.json
