# CCPCOJ Community Fork

An independent, experimental community adaptation of CCPCOJ 2 implementing the September 14, 2026 version of the CCPC ranking rules. The web application, judge, database baseline, and deployment templates were recovered from the `csgrandeur/ccpcoj-web2` and `csgrandeur/ccpcoj-judge2` version 2.0.40 Docker Hub images. The project retains the ThinkPHP administration interface, existing ranking themes, live scoreboard, balloon management, and conventional ICPC mode.

## Disclaimer

**This project is an unofficial community implementation. It is not an official CCPC product, reference implementation, rule publication, or certification of compliance.**

This project is independently developed and is not affiliated with, sponsored by, endorsed by, or authorized to speak on behalf of CCPC, its organizing bodies, any contest organizer, or any other institution or entity. Its code, documentation, interpretations, and design decisions reflect only the work of its contributors and do not represent the views, policies, positions, or official interpretations of CCPC or any other organization. References to third-party software and resources do not imply endorsement by their respective authors or maintainers.

The implementation is experimental and may contain defects, omissions, or interpretations that differ from the rules or procedures applicable to a particular competition. It must not be relied upon as an authoritative statement of competition rules. Applicable official rules, notices, and decisions issued by the relevant competition organizers take precedence over any behavior or description in this repository. Deployment tests and example results do not constitute approval for use in an official event.

The project is provided **"AS IS" and "AS AVAILABLE," without warranties of any kind**, express or implied, including warranties of accuracy, fitness for a particular purpose, reliability, security, or compliance with competition requirements. Operators are responsible for independently evaluating, testing, configuring, and maintaining any deployment, including its judging behavior, ranking calculations, access controls, backups, and operational procedures. To the extent permitted by applicable law, contributors accept no liability for losses, damages, disputed results, or operational disruptions arising from use of this project.

## Implementation Reference

The publicly accessible `rank_ccpc.js` from the site hosting [Contest 1026](https://cpc.csgrandeur.cn/cpcsys/contest/contest/cid/1026.html) was used as a behavioral reference. The public problem area, per-team ordering of hidden problems, referee view, and default reveal threshold aim to follow that implementation. The authenticated live scoreboard and backend were not available for inspection; this project does not claim pixel-perfect rendering or complete backend equivalence.

## Quick Start

Requirements: Linux x86_64, Docker Engine, Docker Compose v2, and Python 3.

```sh
python3 scripts/init_env.py
docker compose config --quiet
docker compose up -d --build
docker compose --profile judge up -d --build judge
docker compose ps
```

The default URL is `http://127.0.0.1:20080/cpcsys/contest`. Initial database setup creates the `admin` and `judger` accounts using the passwords in the generated `.env` file. Existing accounts are not overwritten. Select **CCPC 2026** on the contest editing page to enable the new ranking mode.

The default installation includes a bilingual FAQ at `/cpcsys/faqs` (`/csgoj/faqs` in online mode), even when no FAQ article has been entered in the database. Compiler commands are rendered from the same active configuration used by the judge. New installations default to **C23 / C++23 with O2**.

The judge image installs the toolchain documented by the [reference FAQ](https://cpc.csgrandeur.cn/csgoj/faqs): **Ubuntu 24.04.5 LTS, GCC 14.2.0, Python 3.12.3, and OpenJDK 21.0.12.1**. Versions and Ubuntu package revisions are recorded in `ojweb/config/judge_environment.json`. The Docker build installs the specified JDK and verifies the actual binaries against that manifest; it fails rather than silently substituting a different version. Existing custom judge configurations are preserved during upgrades; change their language standards explicitly in the administration interface when desired.

**Read the [Deployment Guide](docs/DEPLOYMENT.md) before deploying.** It covers contest configuration, backup and recovery, database upgrades, rollback, balloon palettes, and acceptance checks. Some supporting documents are currently available in Chinese.

On October 5, 2026, the Compose stack was validated on a DigitalOcean host running Ubuntu 24.04 x86_64 with 2 vCPUs and 2 GB RAM. Validation included service startup, website access, judge authentication, and actual A+B submissions producing AC, WA, CE, and TLE verdicts. See the [Deployment Fixes and Validation Notes](docs/DEPLOYMENT_FIXES_20261005.md) for the fixes, environment details, optional three-instance configuration, and known limitations, including duplicate task acquisition with concurrent judges.

## Repository Layout

| Path | Contents |
|---|---|
| `ojweb/` | Recovered web application, static assets, framework, and dependencies; CCPC rule and API changes |
| `judge/` | Recovered Python/C++ judge and `judge_lib` |
| `deploy/`, `compose.yaml` | Database baseline, Nginx templates, and build/startup configuration with pinned image digests |
| `compose.workers.yaml` | Optional configuration for three judge instances with separate working volumes |
| `tests/` | Rule tests, independent Python differential checks, JavaScript integration tests, and controller permission tests |
| `scripts/` | Secret initialization, unified test entry point, and source recovery from pinned images |
| `provenance/` | Image indexes, manifests, configurations, recovered file hashes, reference asset hashes, and verification logs |
| `docs/` | Deployment instructions, rule interpretation decisions, provenance, recovery scope, and verification reports |

## Development and Verification

With PHP 7.4, Python 3.9+, and Node.js 20+ installed locally, run:

```sh
sh scripts/test.sh
```

The core rule and frontend test suite does not require a database or a Composer/npm installation. Frontend tests execute the recovered `rank.js`, `rank_page.js`, and balloon scripts directly. An independent Python implementation checks 180 randomized contests across 900 time snapshots. See the [Verification Report](docs/VERIFICATION.md) for coverage and limitations.

The primary implementation entry points are `ojweb/application/common/funcs/CcpcRules.php` and `ojweb/public/static/csgoj/contest/rank_ccpc.js`. The new rules are enabled by `contest_rank_kind=ccpc`; existing contests default to `icpc`.

## Recovery Scope

This repository combines recovery of the image file trees with new functionality. It cannot recover the original Git history, image build process, or site database if those materials were not included in the images. Deployment uses the original runtimes at verified image digests and overlays the application directories with the files in this repository. See the [Recovery and Provenance Notes](docs/RECOVERY.md).
