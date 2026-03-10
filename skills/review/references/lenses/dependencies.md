# Dependencies

## What to look for
- New packages added for small problems already solved in the codebase or platform
- Version bumps that may change behavior, APIs, runtime requirements, or transitive risk
- Dependencies with unclear maintenance, licensing, security, or operational impact
- New tooling that adds setup, build, or deployment complexity
- Unused packages, duplicate packages, or overlapping libraries left behind

## Questions to ask
- Is a new dependency necessary, or would existing code or platform features suffice?
- Does the value justify the long-term maintenance and supply-chain cost?
- Does a version bump require code changes, migrations, or rollout planning?
- Are runtime, bundle size, native build, or deployment implications understood?
- Has obsolete dependency surface been removed after the change?

## Common patterns to flag
- Pulling in a package for one trivial helper
- Adding a second library that overlaps heavily with an existing one
- Major version upgrades with no migration notes or compatibility checks
- New transitive complexity hidden behind a small direct dependency
- Dependencies that require native builds, external services, or special runtime setup
- Package manifest changes without corresponding lockfile or usage updates

## Context to gather
- Review package manifests, lockfiles, and existing utility choices nearby
- Check whether the repository already standardizes on an alternative
- Consider operational constraints such as deploy targets or build environments
- Explain the maintenance or risk tradeoff, not just that a package was added
