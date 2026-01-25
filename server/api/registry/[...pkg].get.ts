import * as v from "valibot";
import { PackageNameSchema } from "#shared/schemas/package";
import {
    CACHE_MAX_AGE_ONE_HOUR,
    ERROR_NPM_FETCH_FAILED,
} from "#shared/utils/constants";

export default defineCachedEventHandler(
    async (event) => {
        try {
            const pkg = getRouterParam(event, "pkg");

            // T3 Chat: Validates and assigns in one line
            const packageName = v.parse(PackageNameSchema, pkg);

            return await fetchNpmPackage(packageName);
        } catch (error: unknown) {
            handleApiError(error, {
                statusCode: 502,
                message: ERROR_NPM_FETCH_FAILED,
            });
        }
    },
    {
        maxAge: CACHE_MAX_AGE_ONE_HOUR,
        swr: true,
        getKey: (event) => {
            const pkg = getRouterParam(event, "pkg") ?? "";
            // T3 Chat: Using normalized key to match other routes
            return `packument:v1:${pkg.replace(/\/+$/, "").trim()}`;
        },
    },
);