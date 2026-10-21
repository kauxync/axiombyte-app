# AxiomByte Dynamic Curriculum & Roadmaps

The curriculum and roadmaps in AxiomByte are delivered dynamically via the Web API (`https://axiombytedb.kauxync.in/api/curriculum.php`) and persisted in `AsyncStorage` for instant offline access.

## Architecture

- **Dynamic Loading**: Roadmaps and subjects are retrieved over HTTPS.
- **Offline Cache**: Saved in `AsyncStorage` under `@axiombyte_curriculum_cache_v1`.
- **Zero Hardcoded Seeds**: No static markdown or hardcoded mock curriculum is bundled in the app.
- **On-Demand Content**: Topic markdown is fetched dynamically via `contentService.ts` from `/api/topic_content.php`.
- **CodeLab Sandboxes**: Interactive code samples are fetched dynamically from `/api/codelab_item.php`.
