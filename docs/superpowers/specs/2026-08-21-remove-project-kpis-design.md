# Remove project KPIs

## Scope

Remove the four-card `Workspace summary` KPI strip from the project page: total projects, conversations, reference files, and active members.

## Design

Delete the KPI markup from `ProjectsPage` and the assertions that cover it. Retain the project list, project details, member controls, and reference files unchanged. Keep the associated CSS because it may be used by related project surfaces and removing it is outside this focused change.

## Verification

Update the page test to assert the summary landmark is absent, then run the focused test and the production build.
