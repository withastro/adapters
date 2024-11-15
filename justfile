default:
    @just --choose

test-workflow:
    act --workflows .github/workflows/hanging-process.yml
