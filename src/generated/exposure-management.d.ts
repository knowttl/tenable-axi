export interface paths {
    "/api/v1/t1/apa/top-attack-paths/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search attack paths
         * @description Returns a list of the top attack paths leading to critical assets. The response includes details about each attack path, such as associated techniques, nodes, and metadata. This endpoint enables you to use advanced search capabilities, including filtering, sorting, and pagination.
         *
         *     **Note:** Attack paths inherit their status from underlying techniques. To prioritize active threats, the system excludes the following statuses by default:
         *     - `chain_prevented` — The attack chain is partially fixed.
         *     - `accepted` — The risk is accepted.
         *     - `done` — Remediation is complete.
         *
         *     To retrieve all paths regardless of status, set the `exclude_resolved` parameter to `false`.
         *
         *     For more information, see [Top Attack Paths](https://docs.tenable.com/exposure-management/Content/attack-path/top-attack-paths.htm) in the _Exposure Management User Guide_. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.READ` custom role privilege. See [Roles](doc:roles) and [Permissions](doc:permissions).</div>
         */
        post: operations["apa-attack-paths-search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/apa/top-attack-techniques/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search attack techniques
         * @description Returns a paginated list of the top attack techniques identified within your organization that match the specified search criteria. This endpoint supports advanced filtering, sorting, and metadata enrichment, including MITRE ATT&CK framework mappings and recommended mitigations.
         *
         *     **Note:** To prioritize actionable data, this endpoint applies default filters to results:
         *     - **Excluded Statuses** — `done`, `accepted`
         *     - **Excluded States** — `archive`
         *
         *     To retrieve all techniques, including archived or resolved items, set the `exclude_resolved` parameter to `false`.
         *
         *     For more information, see [Top Attack Techniques](https://docs.tenable.com/exposure-management/Content/attack-path/top-attack-techniques.htm) in the _Exposure Management User Guide_. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.READ` custom role privilege. See [Roles](doc:roles) and [Permissions](doc:permissions).</div>
         */
        post: operations["apa-attack-techniques-search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/connectors/logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get sync logs
         * @description Retrieves connector sync logs detailing attempts to ingest data from third-party systems, including timestamps, status, and messages for each sync event.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model.<div class="perms-callout">Requires the Administrator [64] user role or the `EXPOSURE_MANAGEMENT.CONNECTOR.CONNECTOR.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["connectors-logs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/export/attack-path": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Export top attack paths
         * @description Submits an export request for top attack paths that match the specified search criteria. Returns an export ID used to check the status of the export and download the results. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE` custom role privilege. See [Roles](doc:roles) and [Permissions](doc:permissions).</div>
         */
        post: operations["apa-export-attack-path"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/export/attack-technique": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Export attack techniques
         * @description Submits an export request for attack technique data that matches the specified search criteria. Returns an export ID used to check the status of the export and download the results. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE` custom role privilege. See [Roles](doc:roles) and [Permissions](doc:permissions).</div>
         */
        post: operations["apa-export-attack-technique"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/export/mitre-heatmap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Export MITRE ATT&CK heatmap
         * @description Submits an export request for MITRE ATT&CK heatmap data that matches the specified filter criteria. JSON exports conform to the [MITRE ATT&CK Navigator](https://mitre-attack.github.io/attack-navigator/) layer schema, enabling direct import into Navigator. CSV exports return a flat table of technique data. Returns an export ID used to check the status of the export and download the results. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE` custom role privilege. See [Roles](doc:roles) and [Permissions](doc:permissions).</div>
         */
        post: operations["apa-export-mitre-heatmap"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/export/{export_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get export status
         * @description Retrieves the current status of an attack path, attack technique, or MITRE heatmap export request. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE` custom role privilege. See [Roles](doc:roles) and [Permissions](doc:permissions).</div>
         */
        get: operations["apa-export-status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/export/{export_id}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download export
         * @description Downloads the results of a completed attack path, attack technique, or MITRE heatmap export request. The response format depends on the `file_format` specified in the original export request. MITRE heatmap exports in JSON format conform to the [MITRE ATT&CK Navigator](https://mitre-attack.github.io/attack-navigator/) layer schema. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ATTACK_PATH.ATTACK_PATH.WRITE` custom role privilege. See [Roles](doc:roles) and [Permissions](doc:permissions).</div>
         */
        get: operations["apa-export-download"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/exposure-view/cards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search cards
         * @description Returns a list of exposure view cards based on your search criteria.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ANALYTICS.EXPOSURE_VIEW.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["exposure-view-cards-search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/exposure-view/cards/{card_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get card details
         * @description Retrieves details for the specified exposure view card. By default, the response includes SLA efficiency and trend data for the past 30 days. You can modify the time frame using optional parameters.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.ANALYTICS.EXPOSURE_VIEW.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["exposure-view-card-details"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/assets/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search assets
         * @description Returns a list of assets in your organization that match the specified search criteria.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        post: operations["inventory-assets-search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/findings/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search findings
         * @description Returns a list of findings in your organization that match the specified search criteria.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        post: operations["inventory-findings-search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/software/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search software
         * @description Returns a list of software installed on your assets that match the specified search criteria.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        post: operations["inventory-software-search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/assets/properties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List asset properties
         * @description Returns a list of asset properties that can be used as filters on endpoints that support them. For example, the properties that are returned by this endpoint can be used as filters for the [Search assets](ref:inventory-assets-search) or [Export assets](ref:inventory-export-assets) endpoints.
         *
         *      In addition to the asset properties, the results list includes the logical operators you can use with the asset properties along with the supported values.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["inventory-asset-properties-list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/findings/properties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List finding properties
         * @description Returns a list of finding properties that can be used for filters on endpoints that support them. For example, the properties that are returned by this endpoint can be used as filters for the [Export findings](ref:inventory-export-findings) endpoint.
         *
         *       In addition to the finding properties, the results list includes the logical operators you can use with the finding properties along with the supported values.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["inventory-finding-properties-list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/software/properties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List software properties
         * @description Returns a list of software properties that can be used for filters on endpoints that support them. For example, the properties that are returned by this endpoint can be used as filters for the [Search software](ref:inventory-software-search) endpoint.
         *
         *       In addition to the software properties, the results list includes the logical operators you can use with the tag properties along with the supported values.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["inventory-software-properties-list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/export/assets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Export assets
         * @description Exports assets in your organization that match the specified search criteria.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT` custom role privilege. See [Roles](doc:roles).</div>
         */
        post: operations["inventory-export-assets"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/export/findings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Export findings
         * @description Exports findings in your organization that match the specified search criteria.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT` custom role privilege. See [Roles](doc:roles).</div>
         */
        post: operations["inventory-export-findings"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/export/assets/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List asset export jobs
         * @description Returns a list of up to 1,000 asset export jobs submitted in the last 3 days, sorted by the most recent refresh time. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["inventory-export-assets-jobs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/export/findings/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List finding export jobs
         * @description Returns a list of up to 1,000 findings export jobs submitted in the last 3 days, sorted by the most recent refresh time. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["inventory-export-findings-jobs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/export/{export_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get export status
         * @description Returns the current status of an export request.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["inventory-export-status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/inventory/export/{export_id}/download/{chunk_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download export
         * @description Downloads a specific export chunk in JSON or CSV format.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.INVENTORY.INVENTORY.EXPORT` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["inventory-export-download"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/tags/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search tags
         * @description Returns a list of tags in your organization that match the specified search criteria.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.TAG.TAG.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        post: operations["inventory-tag-search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/t1/tags/properties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List tag properties
         * @description Returns a list of tag properties that can be used for filters on endpoints that support them. For example, the properties that are returned by this endpoint can be used as filters for the [Search tags](ref:inventory-tag-search) endpoint.
         *
         *       In addition to the tag properties, the results list includes the logical operators you can use with the tag properties along with the supported values.
         *
         *     **Caution:** This endpoint is available for use but is currently in beta. The response structure is subject to change as we continue to enhance the data model. <div class="perms-callout">Requires the Basic [16] user role or the `EXPOSURE_MANAGEMENT.TAG.TAG.READ` custom role privilege. See [Roles](doc:roles).</div>
         */
        get: operations["inventory-tag-properties-list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Attack_Path_ErrorResponse: {
            /** @description The HTTP status code of the error. */
            statusCode?: number;
            /** @description The standard HTTP error name. */
            error?: string;
            /** @description A brief message about the cause of the error. */
            message?: string;
        };
        Attack_Path_NodeInfo: {
            name?: string;
            fullname?: string;
            id?: string;
            labels?: string[];
            /** @default false */
            isCrownJewel: boolean;
            vulnerability_id?: string;
            asset_id?: string;
        };
        Attack_Path_VectorRow: {
            /** @description Indicates whether the vector is new or not. */
            is_new?: boolean;
            /** @description The unique identifier for the vector. */
            vector_id?: string;
            path?: components["schemas"]["Attack_Path_GraphPath"];
            /** @description An array of attack techniques associated with the vector row. */
            techniques?: components["schemas"]["Attack_Path_AttackTechnique"][];
            /** @description An array of nodes associated with the vector. */
            nodes?: components["schemas"]["Attack_Path_AttackPathNode"][];
            /** @description A list of findings associated with the vector. */
            findings_names?: string[];
            /** @description The name of the vector. */
            name?: string;
            /** @description A short summary of the vector. */
            summary?: string | null;
            /** @description The AES (Asset Exposure Score) of the first node associated with the vector. */
            first_aes?: number | null;
            /** @description The ACR (Asset Criticality Score) of the last node associated with the vector row. */
            last_acr?: number;
            /**
             * @description The calculated lifecycle status of the attack path, derived from the statuses of its underlying techniques. This enables you to track remediation progress across the entire attack chain. The statuses are defined as follows:
             *     - `done` — All techniques are done.
             *     - `chain_prevented` — At least one technique is done or accepted, but not all.
             *     - `accepted` — All techniques are accepted.
             *     - Otherwise, the status reflects the least-advanced technique.
             * @enum {string}
             */
            path_status?: "to_do" | "in_progress" | "in_review" | "done" | "chain_prevented" | "accepted";
            /** @description The priority score of the attack path, from 1 to 10. */
            priority?: number;
            /** @description The attack graph node that represents the path vector. */
            graph_node?: components["schemas"]["Attack_Path_AttackPathGraphNode"];
            /** @description The mitigations that apply to the attack path. */
            mitigations?: Record<string, never>[];
        };
        /** @description Graph path information associated with the vector row, including the starting node, ending node, and the segments comprising the graph path. */
        Attack_Path_GraphPath: {
            start?: components["schemas"]["Attack_Path_AbstractNodeGraphNode"];
            end?: components["schemas"]["Attack_Path_AbstractNodeGraphNode"];
            /** @description Segments comprising the graph path. */
            segments?: components["schemas"]["Attack_Path_GraphPathSegment"][];
        } | null;
        /** @description Information about the nodes and segments comprising the graph path. There are starting nodes and ending nodes. */
        Attack_Path_AbstractNodeGraphNode: {
            /** @description The name of the node. */
            name?: string;
            /** @description A short description of the node. */
            description?: string;
            /** @description Indicates whether or not the node is built-in. */
            _builtin?: boolean;
            /**
             * Format: int64
             * @description A Unix timestamp indicating the date and time when the node was created.
             */
            whencreated?: number;
            /** @description The Asset Criticality Rating (ACR) associated with the node. */
            acr?: number;
            /** @description The Asset Exposure Score (AES) associated with the node. */
            aes?: number;
            /** @description The Asset Vulnerability Rating (AVR) associated with the node. */
            avr?: number;
            /** @description The Attack Path Analysis Asset Exposure Score (APA AES) associated with the node. */
            apa_aes?: number;
            /** @description The unique identifier of the asset associated with the node. */
            asset_id?: string;
            /**
             * Format: int64
             * @description A Unix timestamp indicating the date and time when the node was last scanned.
             */
            last_scanned?: number;
            /**
             * Format: int64
             * @description A Unix timestamp indicating the date and time when the node was last observed.
             */
            last_observed?: number;
            /**
             * Format: int64
             * @description A Unix timestamp indicating the date and time when the node was last licensed.
             */
            last_licensed?: number;
            /** @description An array of sensors associated with the node. */
            sensors?: string[];
            /** @description An array of sources associated with the node. */
            sources?: components["schemas"]["Attack_Path_NodeInfo"][];
        };
        /** @description Graph path information associated with the vector row, including the starting node and ending node of the graph path segment. */
        Attack_Path_GraphPathSegment: {
            start?: components["schemas"]["Attack_Path_AbstractNodeGraphNode"];
            end?: components["schemas"]["Attack_Path_AbstractNodeGraphNode"];
            relationship?: components["schemas"]["Attack_Path_AbstractRelationship"];
        };
        /** @description Information about the relationship between the starting and ending nodes. */
        Attack_Path_AbstractRelationship: {
            /** @description The unique identifier of the relationship. */
            id?: number;
            /** @description The identifier of the starting node. */
            start?: number;
            /** @description The identifier of the ending node. */
            end?: number;
            /** @description Type of the relationship. */
            type?: string;
            /** @description Properties associated with the relationship. */
            properties?: Record<string, never>;
        };
        Attack_Path_AttackTechnique: {
            /** @description An array of nodes associated with the attack technique. */
            nodes?: number[];
            method?: components["schemas"]["Attack_Path_ProcedureGraphNode"];
            /** @description Name of the attack technique. */
            technique?: string;
            /** @description Information about the sources related to the attack technique. */
            source_information?: string;
            /** @description Array of weakness identifiers associated with the attack technique. */
            weaknessesIds?: string[];
            /** @description External identifier associated with the attack technique. */
            external_id?: string;
            /** @description Target of the attack technique. */
            target?: string;
            /** @description The internal identifier of the technique node. */
            id?: number;
            /** @description The name of the technique. */
            name?: string;
            /** @description The fully qualified name of the technique. */
            full_name?: string;
            /** @description The UUID of the asset the technique applies to, or an empty string if it applies to no specific asset. */
            asset_id?: string;
            /** @description The graph labels applied to the technique node. */
            labels?: string[];
            /** @description The UUID of the procedure the technique corresponds to. */
            procedure_uuid?: string;
            /** @description The weight the attack path algorithm assigns to the technique. */
            apa_weight?: number | null;
            /** @description The mitigations that apply to the technique. */
            mitigations?: Record<string, never>[];
        };
        /** @description The procedure node representing the method used in the attack technique. */
        Attack_Path_ProcedureGraphNode: {
            /** @description The name of the procedure. */
            name?: string;
            /** @description The unique identifier of the procedure. */
            uuid?: string;
            /** @description The number of attack vectors associated with the procedure. */
            vector_count?: number;
            /**
             * @description The current status of the procedure.
             * @enum {string}
             */
            status?: "to_do" | "in_progress" | "in_review" | "done" | "accepted";
            /**
             * @description The current state of the procedure.
             * @enum {string}
             */
            state?: "open" | "archive";
            /** @description Metadata associated with the procedure. */
            metadata?: Record<string, never>;
            /** @description The priority score assigned to the procedure. */
            priority_score?: number;
            /** @description Information about the sources related to the procedure. */
            source_information?: string;
            /**
             * Format: int64
             * @description A Unix timestamp indicating the date and time when the procedure was last updated.
             */
            _updated?: number;
            /** @description The internal identifier of the procedure node. */
            _id?: number;
        };
        /** @description Defines a single filter condition used to narrow the search results for attack paths. */
        "Attack_Path_Attack-Path-Single-Filter": {
            /**
             * @description Specifies the property used to filter the results. For example: `priority`, `name`, or `technique`.
             * @enum {string}
             */
            property?: "priority" | "name" | "summary" | "steps" | "asset_exposure" | "blast_radius" | "asset_id" | "freetext" | "finding_id" | "technique" | "weakness_id" | "critical_asset" | "data_source" | "apa_aes" | "acr" | "path_status";
            /**
             * @description Specifies the comparison operator applied to the property filter. For example: `eq` (equals), `ne` (not equals), or `contains`.
             * @enum {string}
             */
            operator?: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains" | "in" | "not_in";
            /** @description Defines the specific value or values to match against the property. This can be a single value or an array of values depending on the operator used. */
            value?: string | string[] | number | number[] | (true | false);
        };
        /** @description Specifies a compound filter that combines multiple conditions. Use this structure to create complex, multi-level filtering logic using logical operators. */
        "Attack_Path_Attack-Path-Multiple-Filters-Nested": {
            /**
             * @description Specifies the logical operator used to combine multiple filter conditions.
             * @default AND
             * @enum {string}
             */
            operator: "AND" | "OR";
            /** @description Contains an array of single filter conditions. */
            value: components["schemas"]["Attack_Path_Attack-Path-Single-Filter"][];
        };
        /** @description Response format for the V2 endpoint, providing paginated attack path data */
        Attack_Path_DiscoverPageTableResponse: {
            /** @description An array of attack paths representing the search results */
            data: components["schemas"]["Attack_Path_VectorRow"][];
            /** @description Pagination information for the result set. */
            pagination?: components["schemas"]["Attack_Path_AttackTechniquePaginationInfo"];
        };
        /** @description Defines a single filter condition used to narrow the search results for attack techniques. */
        "Attack_Path_Attack-Technique-Single-Filter": {
            /**
             * @description Specifies the property used to filter the results. For example: `priority`, `name`, or `last_updated_at`.
             * @enum {string}
             */
            property?: "priority" | "state" | "status" | "name" | "procedureName" | "mitre_id" | "tactics" | "target" | "source" | "cause" | "last_updated_at" | "created" | "serial_id";
            /**
             * @description Specifies the comparison operator applied to the property filter. For example: `eq` (equals), `ne` (not equals), or `contains`.
             * @enum {string}
             */
            operator?: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains" | "in" | "not_in";
            /** @description Defines the specific value or values to match against the property. This can be a single value or an array of values depending on the operator used. */
            value?: string | string[] | number | number[] | (true | false);
        };
        /**
         * AttackTechniqueFilterOperator
         * @description Specifies a compound filter that combines multiple conditions. Use this structure to create complex, multi-level filtering logic using logical operators.
         */
        "Attack_Path_Attack-Technique-Multiple-Filters": {
            /**
             * @description Specifies the logical operator used to combine multiple filter conditions.
             * @enum {string}
             */
            operator: "and" | "or";
            /** @description Contains an array of filter objects. Each item can be a single filter condition or a nested operator object. */
            value: (components["schemas"]["Attack_Path_Attack-Technique-Single-Filter"] | components["schemas"]["Attack_Path_Attack-Technique-Multiple-Filters-Nested"])[];
        };
        /**
         * Attack-Technique-Multiple-Filters-Nested
         * @description Defines a nested logical operator used within a compound filter. This enables deep filtering logic while preventing circular references.
         */
        "Attack_Path_Attack-Technique-Multiple-Filters-Nested": {
            /**
             * @description Specifies the logical operator used to combine the nested conditions.
             * @enum {string}
             */
            operator: "and" | "or";
            /** @description Contains an array of single filter conditions. */
            value: components["schemas"]["Attack_Path_Attack-Technique-Single-Filter"][];
        };
        /**
         * AttackTechniqueSearchResult
         * @description Attack technique search result information
         */
        Attack_Path_AttackTechniqueSearchResult: {
            /** @description MITRE ATT&CK technique ID */
            mitre_id: string;
            /** @description List of mitigations */
            mitigations?: string[];
            /** @description List of associated malwares */
            malwares?: string[];
            /** @description List of associated tools */
            tools?: string[];
            /** @description Name of the attack technique */
            name: string;
            /**
             * @description Priority level
             * @enum {string}
             */
            priority: "low" | "medium" | "high" | "critical";
            /**
             * @description Current state
             * @enum {string}
             */
            state: "open" | "archive";
            /**
             * @description Current status
             * @enum {string}
             */
            status: "to_do" | "in_progress" | "in_review" | "done" | "accepted";
            /** @description MITRE ATT&CK tactics */
            tactics?: string[];
            /**
             * Format: date-time
             * @description Creation timestamp
             */
            created: string;
            /** @description The date and time when the technique was last updated, as an ISO 8601 timestamp with fractional seconds and no UTC offset, for example `2026-02-10T12:48:31.387797`. */
            last_updated_at: string;
            /** @description Serial identifier */
            serial_id: number;
            /** @description The name of the technique, including its graph node identifier. */
            technique_name?: string;
            /** @description The number of attack path vectors that use the technique and are visible to you. */
            vector_count?: number;
            /** @description The total number of attack path vectors that use the technique. */
            total_vector_count?: number;
            /** @description The number of critical assets affected by the technique and visible to you. */
            critical_assets_count?: number;
            /** @description The total number of critical assets affected by the technique. */
            total_critical_assets_count?: number;
            /** @description The UUIDs of the assets the technique affects. */
            assets_ids?: string[];
            /** @description The identifiers of the detections that evidence the technique, for example `NESSUS:71246`. */
            detection_ids?: string[];
            /** @description The identifiers of the weaknesses the technique exploits, for example CVEs. */
            weaknesses_ids?: string[];
            /** @description The threat actor groups known to use the technique. */
            groups?: string[];
            /** @description The detections that contributed evidence for the technique. */
            source_information?: components["schemas"]["Attack_Path_AttackTechniqueSourceInformation"][];
            /** @description The attack graph nodes related to the technique. */
            related_nodes?: {
                /** @description The node that causes the technique to be possible. */
                cause?: components["schemas"]["Attack_Path_AttackGraphRelatedNode"];
                /** @description The nodes an attacker moves from. */
                sources?: components["schemas"]["Attack_Path_AttackGraphRelatedNode"][];
                /** @description The nodes an attacker moves to. */
                targets?: components["schemas"]["Attack_Path_AttackGraphRelatedNode"][];
            };
        };
        /**
         * AttackTechniquesSearchResponse
         * @description Response model for attack techniques search endpoint
         */
        Attack_Path_AttackTechniquesSearchResponse: {
            /** @description Array of attack techniques */
            data: components["schemas"]["Attack_Path_AttackTechniqueSearchResult"][];
            pagination: components["schemas"]["Attack_Path_AttackTechniquePaginationInfo"];
        };
        /**
         * AttackTechniquePaginationInfo
         * @description Pagination information for attack techniques search
         */
        Attack_Path_AttackTechniquePaginationInfo: {
            /** @description Total number of attack techniques that match the search criteria */
            total: number;
            /** @description Number of items skipped for pagination */
            offset: number;
            /** @description Number of items per page */
            limit: number;
            sort: components["schemas"]["Attack_Path_AttackTechniqueSortInfo"];
        };
        /**
         * AttackTechniqueSortInfo
         * @description Sort information for attack techniques search
         */
        Attack_Path_AttackTechniqueSortInfo: {
            /**
             * @description The field the results are sorted by.
             * @enum {string}
             */
            name: "last_updated_at" | "priority" | "mitre_id" | "name" | "procedureName" | "status" | "state" | "vectorCount";
            /**
             * @description Sort order
             * @enum {string}
             */
            order: "asc" | "desc";
        };
        /** @description A filter operator that combines multiple filter conditions for attack paths. The value array can contain both filter conditions and nested filter operators to create complex filtering logic. */
        "Attack_Path_Attack-Path-Multiple-Filters": {
            /**
             * @description The logical operator to combine conditions
             * @default AND
             * @enum {string}
             */
            operator: "AND" | "OR";
            /** @description Array of filter conditions or operators. This can contain a mix of Attack-Path-Single-Filter objects and nested filter operators to create complex nested filtering logic. */
            value: (components["schemas"]["Attack_Path_Attack-Path-Single-Filter"] | components["schemas"]["Attack_Path_Attack-Path-Multiple-Filters-Nested"])[];
        };
        /**
         * AttackGraphRelatedNode
         * @description A node in the attack graph that relates to the technique, either as its cause or as one of its sources or targets.
         */
        Attack_Path_AttackGraphRelatedNode: {
            /** @description The internal identifier of the graph node. */
            id?: string;
            /** @description The display name of the node. */
            name?: string;
            /** @description The fully qualified name of the node, such as a domain-qualified account or a hostname. */
            fullname?: string | null;
            /** @description The UUID of the asset the node represents, or null if the node is not an asset. */
            asset_id?: string | null;
            /** @description The graph labels applied to the node, for example `Asset` or `Local`. */
            labels?: string[];
            /** @description The data sources that contributed the node, for example `T.IO`. */
            sources?: string[];
            /** @description Indicates whether the node is designated a crown jewel. */
            isCrownJewel?: boolean;
            /** @description Indicates whether role-based access control restricts your view of the node. */
            rbac_restricted?: boolean;
            /** @description The identifier of the vulnerability the node represents, for example a CVE, or null if the node is not a vulnerability. */
            vulnerability_id?: string | null;
        };
        /**
         * AttackTechniqueSourceInformation
         * @description A detection that contributed evidence for the technique.
         */
        Attack_Path_AttackTechniqueSourceInformation: {
            /** @description The identifier of the detection, for example `nessus:71246`. */
            id?: string | null;
            /** @description The kind of detection, for example `nessus plugin` or `CVE`. */
            type?: string | null;
            /** @description The UUID of the asset the detection applies to. */
            asset_id?: string | null;
            /** @description The provider that supplied the detection, for example `NESSUS` or `NVD`. */
            provider_code?: string;
            /** @description The provider's own identifier for the detection, for example a Nessus plugin ID. */
            provider_detection_id?: string;
            /** @description The name of the plugin that produced the detection. */
            plugin_name?: string | null;
            /** @description The provider's detection code or short name. */
            detection_code?: string | null;
            /** @description The identifier of the reason the detection contributed to the technique. */
            reason_id?: string | null;
            /** @description The name of the reason the detection contributed to the technique. */
            reason_code_name?: string | null;
        };
        /**
         * AttackPathGraphNode
         * @description The attack graph node that represents the attack path vector.
         */
        Attack_Path_AttackPathGraphNode: {
            /** @description The internal identifier of the graph node. */
            _id?: number;
            /** @description The graph labels applied to the node, for example `Vector`. */
            _labels?: string[];
            /** @description The Unix timestamp, in seconds, when the node was created. */
            _created?: number;
            /** @description The Unix timestamp, in seconds, when the node last changed. */
            _changed?: number;
            /** @description The Unix timestamp, in seconds, when the node was last confirmed present. */
            _actual?: number;
            /** @description The node type, for example `Vector`. */
            type?: string;
            /** @description The node type as shown in the user interface. */
            display_type?: string;
            /** @description The name of the attack path. */
            name?: string;
            /** @description The fully qualified name of the vector. */
            full_name?: string;
            /** @description A description of what an attacker achieves along the path. */
            summary?: string;
            /** @description The unique identifier of the attack path vector. */
            vector_id?: string;
            /** @description The UUIDs of the assets on the path, as a comma-separated string. */
            asset_ids?: string;
            /** @description The remediation status of the path, for example `to_do` or `in_progress`. */
            path_status?: string;
            /** @description The priority score of the path, from 1 to 10. */
            priority?: number;
            /** @description Indicates whether the path ends at a crown jewel asset. */
            is_crown_jewel?: boolean;
            /** @description Indicates whether at least one mitigation applies to the path. */
            has_mitigation?: boolean;
            /** @description The mitigations that apply to the path. */
            mitigations?: Record<string, never>[];
            /** @description The data sources that contributed the path, for example `NESSUS`. */
            providers?: string[];
            /** @description The nodes on the path, each as a JSON-encoded string. */
            related_nodes?: string[];
        };
        /**
         * AttackPathNode
         * @description A node on the attack path.
         */
        Attack_Path_AttackPathNode: {
            /** @description The internal identifier of the node. */
            id?: number;
            /** @description The display name of the node. */
            name?: string;
            /** @description The fully qualified name of the node. */
            full_name?: string;
            /** @description The UUID of the asset the node represents, or an empty string if the node is not an asset. */
            asset_id?: string;
            /** @description The graph labels applied to the node, for example `Asset` or `ServiceAccount`. */
            labels?: string[];
            /** @description The mitigations that apply to the node. */
            mitigations?: Record<string, never>[];
        };
        /** @description The response object containing the list of connector sync logs matching the filter criteria. */
        "Connectors_Response-Get-Sync-Logs": {
            /** @description An array of individual connector sync log entries matching the filter criteria. */
            items?: components["schemas"]["Connectors_Sync-Log-Object"][];
            /**
             * @description The total number of connector sync logs that match the request criteria.
             * @example 10
             */
            total_count?: number;
        };
        /** @description A single connector sync and the stages and log entries it produced. */
        "Connectors_Sync-Log-Object": {
            /**
             * Format: uuid
             * @description The unique identifier (UUID) for the connector sync attempt. This value can be used to reference or track a specific sync operation.
             */
            sync_uuid?: string;
            status?: components["schemas"]["Connectors_SyncStatus"];
            sync_timestamp?: components["schemas"]["Connectors_SyncTimestamp"];
            type?: components["schemas"]["Connectors_SyncType"];
            trigger_reason?: components["schemas"]["Connectors_TriggerReason"];
            /** @description The unique numeric identifier of the connector associated with this sync log. */
            connector_id?: number;
            /** @description An array of objects representing all the individual stages that were part of a connector sync. Each item provides details about the stage's name, status, timing, duration, and whether it involved an external system. */
            sync_stages_info?: components["schemas"]["Connectors_SyncStage"][];
            /** @description An array of log entries generated during the connector sync, providing detailed information about individual events that occurred during the sync. */
            sync_logs?: components["schemas"]["Connectors_SyncLog"][];
        };
        /**
         * @description Indicates the outcome of the connector sync. Possible values are `SUCCEEDED` for a successful sync or `FAILED` for a failed sync.
         * @example SUCCEEDED
         * @enum {string}
         */
        Connectors_SyncStatus: "SUCCEEDED" | "FAILED";
        /** @description Timestamps and duration information for the connector sync. */
        Connectors_SyncTimestamp: {
            /**
             * Format: date-time
             * @description An ISO timestamp indicating the date and time when the sync started.
             */
            start?: string;
            /**
             * Format: date-time
             * @description An ISO timestamp indicating the date and time when the sync ended.
             */
            end?: string;
            /** @description The total duration of the sync in milliseconds. */
            duration_ms?: number;
        };
        /**
         * @description Indicates the type of connector sync performed:
         *      * `FULL` — A full sync that retrieves all data from the connector.
         *      * `DELTA` — A delta sync that retrieves only new or updated data since the last sync.
         * @enum {string}
         */
        Connectors_SyncType: "FULL" | "DELTA";
        /**
         * @description Specifies why the connector sync was initiated. Possible values include:
         *      * `SCHEDULE` — The sync was triggered according to a scheduled interval.
         *      * `MANUAL` — The sync was started manually by a user.
         *      * `RETRY` — The sync was retried following a previous failure.
         *      * `UNKNOWN` — The reason for the sync could not be determined.
         * @enum {string}
         */
        Connectors_TriggerReason: "UNKNOWN" | "MANUAL" | "SCHEDULE" | "RETRY";
        /** @description One stage within a connector sync. */
        Connectors_SyncStage: {
            /** @description The name of the sync stage. */
            name?: string;
            status?: components["schemas"]["Connectors_StageStatus"];
            /**
             * Format: date-time
             * @description An ISO timestamp indicating the date and time when the sync stage started.
             */
            start_timestamp?: string;
            /**
             * Format: date-time
             * @description An ISO timestamp indicating the date and time when the sync stage ended. Tenable returns this property once the stage finishes.
             */
            end_timestamp?: string;
            /** @description The duration of the sync stage in milliseconds. Tenable returns this property once the stage finishes. */
            duration_ms?: number;
            /** @description Indicates whether the stage involved an external system (`true`) or was internal (`false`). */
            external?: boolean;
        };
        /**
         * @description The current state of an individual stage within a connector sync. Possible values are:
         *      * `QUEUED` — The stage is waiting to start.
         *      * `IN_PROGRESS` — The stage is currently executing.
         *      * `SUCCEEDED` — The stage completed successfully.
         *      * `FAILED` — The stage completed unsuccessfully.
         * @enum {string}
         */
        Connectors_StageStatus: "QUEUED" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";
        /** @description A single log entry recorded during a connector sync. */
        Connectors_SyncLog: {
            /**
             * Format: date-time
             * @description An ISO timestamp indicating the date and time when the log entry was created.
             */
            timestamp?: string;
            level?: components["schemas"]["Connectors_LogLevel"];
            /** @description The full text of the log entry. */
            text?: string;
            type?: components["schemas"]["Connectors_LogType"];
            /** @description A condensed or summarized version of the log text for easier reading. This property is not returned for every log entry. */
            summarized_text?: string;
        };
        /**
         * @description The severity level of a log entry. Possible values are:
         *      * `INFO` — Informational messages about normal operations.
         *      * `WARNING` — Events that may indicate potential issues.
         *      * `ERROR` — Events that indicate failures or errors during sync processing.
         * @enum {string}
         */
        Connectors_LogLevel: "INFO" | "WARNING" | "ERROR";
        /**
         * @description The category of the log entry. Possible values are:
         *      * `REGULAR` — Standard operational logs.
         *      * `DETAILED` — More verbose logs providing additional context or debug information.
         *      * `INTERNAL` — Logs used internally by the system, typically not relevant for general users.
         * @enum {string}
         */
        Connectors_LogType: "REGULAR" | "DETAILED" | "INTERNAL";
        Connectors_ErrorResponse: {
            /** @description The HTTP status code of the error. */
            statusCode?: number;
            /** @description The standard HTTP error name. */
            error?: string;
            /** @description A brief message about the cause of the error. */
            message?: string;
        };
        "Connectors_ErrorResponse-422": {
            /** @description Information about the unprocessable entity. */
            detail?: {
                /** @description An array of information containing the parameter type and the name of the parameter where the error occurred. */
                loc?: string[];
                /** @description A brief description describing the error. */
                msg?: string;
                /** @description The type of error that occurred. */
                type?: string;
            };
        };
        "Connectors_ErrorResponse-400": {
            /** @description Information about why the request was rejected. */
            detail?: {
                /** @description A message describing the error, suitable for display. */
                display_message?: string;
                /** @description A technical description of the error, when one is available. */
                technical_message?: string | null;
                /** @description An identifier for the category of error, for example `invalid_date_query`. */
                error_type?: string;
                /** @description Additional information about the error, when any is available. */
                data?: Record<string, never> | null;
            };
        };
        "Attack_Path_Exports_Request-Export-Attack-Paths": {
            file_format: components["schemas"]["Attack_Path_Exports_FileFormat"];
            /** @description Specifies filter conditions for the export. Accepts a single condition or multiple conditions combined with a logical operator. */
            filters?: components["schemas"]["Attack_Path_Exports_Attack-Path-Single-Filter"] | components["schemas"]["Attack_Path_Exports_Attack-Path-Multiple-Filters"];
            /** @description Specifies an optional list of attack path vector IDs (UUIDs) to export. If specified, the system only exports the vectors matching these IDs. If omitted, the system exports all vectors matching the filter criteria. */
            vector_ids?: string[];
            /**
             * @description Specifies the columns to include in the export. If omitted, the system includes all available columns.
             * @example [
             *       "path_name"
             *     ]
             */
            columns?: ("path_name" | "priority" | "source_nes" | "target_acr" | "sequence_chain" | "enabler_list" | "asset_ids")[];
            /** @description Specifies a custom name for the exported file. If omitted, the system generates a default name. */
            file_name?: string;
            sort?: components["schemas"]["Attack_Path_Exports_ExportSortParams"];
        };
        "Attack_Path_Exports_Request-Export-Attack-Techniques": {
            file_format: components["schemas"]["Attack_Path_Exports_FileFormat"];
            /** @description Specifies filter conditions for the export. Accepts a single condition or multiple conditions combined with a logical operator. */
            filters?: components["schemas"]["Attack_Path_Exports_Attack-Technique-Single-Filter"] | components["schemas"]["Attack_Path_Exports_Attack-Technique-Multiple-Filters"];
            /** @description Specifies an optional list of attack technique UUIDs to export. If specified, the system only exports the techniques matching these IDs. If omitted, the system exports all techniques matching the filter criteria. */
            attack_technique_ids?: string[];
            /**
             * @description Specifies the columns to include in the export. If omitted, the system includes all available columns.
             * @example [
             *       "mitre_id"
             *     ]
             */
            columns?: ("mitre_id" | "technique_name" | "priority" | "status" | "state" | "through" | "source_names" | "source_classes" | "source_ids" | "target_names" | "target_classes" | "target_ids" | "tactics" | "data_sources" | "top_attack_path_count" | "critical_assets_count")[];
            /** @description Specifies a custom name for the exported file. If omitted, the system generates a default name. */
            file_name?: string;
            sort?: components["schemas"]["Attack_Path_Exports_ExportSortParams"];
        };
        "Attack_Path_Exports_Request-Export-Mitre-Heatmap": {
            file_format: components["schemas"]["Attack_Path_Exports_FileFormat"];
            filter?: components["schemas"]["Attack_Path_Exports_Mitre-Heatmap-Filter"];
            /**
             * @description Specifies the columns to include in the export. Applies to the CSV format only; the JSON (Navigator Layer) format ignores this field. If omitted, the system includes all available columns.
             * @example [
             *       "technique_id",
             *       "tactic",
             *       "technique_name",
             *       "max_priority"
             *     ]
             */
            columns?: ("technique_id" | "tactic" | "technique_name" | "max_priority" | "critical_assets_count" | "top_attack_technique_count" | "top_attack_path_count" | "link")[];
            /** @description Specifies a custom name for the exported file. If omitted, the system uses a default name in the format `Tenable_APA_MITRE_YYYY-MM-DD`. */
            file_name?: string;
        };
        /** @description Defines the filter criteria used to narrow the MITRE ATT&CK heatmap export. All fields are optional. If omitted entirely, the system returns the full heatmap for the default `enterprise` matrix. */
        "Attack_Path_Exports_Mitre-Heatmap-Filter": {
            /**
             * @description Specifies the MITRE ATT&CK matrix to export. Supported values: `enterprise` (Enterprise matrix) or `ics` (Industrial Control Systems matrix). If omitted, the system uses the default value of `enterprise`.
             * @enum {string}
             */
            matrix?: "enterprise" | "ics";
            /**
             * @description Specifies the platform used to filter techniques. Only techniques applicable to the specified platform are included in the export.
             *
             *     Supported platforms:
             *
             *     * `Windows`
             *     * `Linux`
             *     * `macOS`
             *     * `Network`
             *     * `PRE`
             *     * `Containers`
             *     * `Office Suite` — Cloud platform.
             *     * `Identity Provider` — Cloud platform.
             *     * `SaaS` — Cloud platform.
             *     * `IaaS` — Cloud platform.
             */
            platform?: string;
            /** @description Specifies a search string used to filter techniques by name. The system performs a case-insensitive substring match against technique names. */
            query?: string;
            /** @description Specifies whether to include all techniques in the matrix, regardless of active findings. When `true`, the export includes techniques with no findings in your environment. If omitted, the system uses the default value of `false`, returning only techniques with at least one active finding. */
            show_all_techniques?: boolean;
            /** @description Specifies the severity levels used to filter techniques. Only techniques with at least one finding at the specified severity levels are included. Supported values: `info`, `low`, `medium`, `high`, `critical`. */
            severities?: ("info" | "low" | "medium" | "high" | "critical")[];
        };
        /** @description The MITRE ATT&CK Navigator layer document returned for JSON exports. Conforms to the [official Navigator layer format](https://github.com/mitre-attack/attack-navigator/blob/master/layers/spec/v4.5/layerformat.md), enabling direct import into Navigator. */
        Attack_Path_Exports_MitreHeatmapNavigatorLayer: {
            /** @description The display name of the Navigator layer (for example, `Tenable APA MITRE Heatmap`). */
            name?: string;
            /** @description The ATT&CK, Navigator, and layer schema versions used to generate this layer. */
            versions?: {
                /** @description The MITRE ATT&CK content version (for example, `14`). */
                attack?: string;
                /** @description The minimum Navigator version required to render this layer (for example, `4.9.5`). */
                navigator?: string;
                /** @description The Navigator layer schema version (for example, `4.5`). */
                layer?: string;
            };
            /** @description The ATT&CK domain for this layer (for example, `enterprise-attack` or `ics-attack`). */
            domain?: string;
            /** @description A human-readable summary of the layer content. */
            description?: string;
            /** @description The platform filters applied to the layer. Navigator uses these to restrict which techniques are visible based on the platforms they apply to. */
            filters?: {
                /** @description A list of platforms included in the layer view. Only techniques applicable to at least one of the listed platforms are displayed. */
                platforms?: string[];
            };
            /**
             * @description The sort order applied to techniques in the Navigator view. Supported values:
             *
             *     * `0` — Default order.
             *     * `1` — Ascending alphabetically by technique name.
             *     * `2` — Ascending by score.
             *     * `3` — Descending by score.
             */
            sorting?: number;
            /** @description The visual layout configuration for the Navigator layer. */
            layout?: {
                /** @description The layout mode used to render techniques. Supported values: `side` (sub-techniques displayed beside their parent), `flat` (all techniques displayed inline), `mini` (compact view). */
                layout?: string;
                /** @description The aggregation function applied when a technique appears under multiple tactics. Supported values: `average`, `min`, `max`, `sum`. */
                aggregateFunction?: string;
                /** @description Indicates whether technique IDs are displayed in Navigator cells. */
                showID?: boolean;
                /** @description Indicates whether technique names are displayed in Navigator cells. */
                showName?: boolean;
                /** @description Indicates whether aggregate scores are displayed in Navigator cells. */
                showAggregateScores?: boolean;
                /** @description Indicates whether unscored techniques are counted when calculating aggregate scores. */
                countUnscored?: boolean;
            };
            /** @description Indicates whether techniques with `enabled` set to `false` are hidden from the Navigator view. When `false`, disabled techniques are shown greyed out. */
            hideDisabled?: boolean;
            /** @description A list of technique entries scored and annotated for this layer. */
            techniques?: components["schemas"]["Attack_Path_Exports_MitreHeatmapTechniqueRecord"][];
            /** @description The color gradient configuration applied to technique scores when rendered in Navigator. */
            gradient?: {
                /** @description An ordered list of hex color strings defining the gradient. Colors are distributed evenly across the score range from `minValue` to `maxValue`. */
                colors?: string[];
                /** @description The minimum score value mapped to the first color in the gradient. */
                minValue?: number;
                /** @description The maximum score value mapped to the last color in the gradient. */
                maxValue?: number;
            };
            /** @description A list of entries displayed in the Navigator legend, describing the color-to-severity mapping used in this layer. */
            legendItems?: {
                /** @description The severity label for this legend entry (for example, `Critical` or `High`). */
                label?: string;
                /** @description The hex color code associated with this legend entry. */
                color?: string;
            }[];
        };
        /** @description A single technique entry in the MITRE heatmap export. CSV exports represent the same fields flattened to one row per technique. */
        Attack_Path_Exports_MitreHeatmapTechniqueRecord: {
            /** @description The MITRE ATT&CK technique identifier (for example, `T1078` or `T1078.004`). */
            techniqueID?: string;
            /** @description The MITRE ATT&CK tactic slug associated with this technique entry (for example, `initial-access`). */
            tactic?: string;
            /** @description The exposure score for this technique in your environment. Derived from the count and severity of active findings mapped to this technique. Higher values indicate greater exposure. */
            score?: number;
            /** @description The hex color code Navigator renders for this technique, derived from the score and the layer gradient definition. */
            color?: string;
            /** @description A pipe-delimited summary of the key metrics driving this technique's score, including the top attack technique count, top attack path count, and critical asset count. */
            comment?: string;
            /** @description Indicates whether Navigator highlights this technique. The system sets this to `true` for techniques with active findings, and `false` for techniques included only because `show_all_techniques` is `true`. */
            enabled?: boolean;
            /** @description A list of structured key-value metadata entries that surface the same metrics as the `comment` field, suitable for programmatic access in Navigator. */
            metadata?: {
                /** @description The name of the metadata metric. Supported values: `Top Attack Technique Count`, `Top Attack Path Count`, `Critical Asset Count`. */
                name?: string;
                /** @description The value of the metadata metric. */
                value?: string;
            }[];
        };
        /** @description A single attack path record in the export results. */
        Attack_Path_Exports_AttackPathExportRecord: {
            /** @description The name assigned to the attack path. For many paths, the system uses generative AI to create a descriptive name based on the potential threat. */
            path_name?: string;
            /** @description The priority level assigned to the attack path. Possible values include `Critical`, `High`, `Medium`, and `Low`. */
            priority_rating?: string;
            /** @description The Node Exposure Score (NES) of the starting node in the attack path. */
            source_nes?: number;
            /** @description The Asset Criticality Rating (ACR) of the final destination asset in the attack path. */
            target_acr?: number;
            /** @description The structured progression of the attack path, showing the sequence of assets and techniques from source to destination. */
            sequence_chain?: string;
            /** @description A semicolon-separated list of the primary security gaps or configurations (enablers) that facilitate the attack path. */
            enablers?: string;
            /** @description A semicolon-separated list of the unique identifiers (UUIDs) for all assets involved in the attack path, listed in order of progression. */
            asset_ids?: string;
        };
        /** @description A single attack technique record in the export results. */
        Attack_Path_Exports_AttackTechniqueExportRecord: {
            /** @description The MITRE ATT&CK technique identifier (for example, `T1003`). */
            mitre_id?: string;
            /** @description The descriptive name of the attack technique. */
            technique_name?: string;
            /** @description The priority level assigned to the attack technique. Possible values include `Critical`, `High`, `Medium`, and `Low`. */
            priority?: string;
            /** @description The current workflow status of the attack technique. Possible values include `to_do`, `in_progress`, `in_review`, `done`, and `accepted`. */
            status?: string;
            /** @description The operational state of the attack technique. Possible values include `open` and `archive`. */
            state?: string;
            /** @description The primary security gap or enabler that facilitates this technique. */
            through?: string;
            /** @description A semicolon-separated list of names for the originating source assets. */
            source_names?: string;
            /** @description A semicolon-separated list of asset classes for the originating source assets. */
            source_classes?: string;
            /** @description A semicolon-separated list of the unique identifiers (UUIDs) for the originating source assets. */
            source_ids?: string;
            /** @description A semicolon-separated list of names for the destination target assets. */
            target_names?: string;
            /** @description A semicolon-separated list of asset classes for the destination target assets. */
            target_classes?: string;
            /** @description A semicolon-separated list of the unique identifiers (UUIDs) for the destination target assets. */
            target_ids?: string;
            /** @description A semicolon-separated list of the associated MITRE ATT&CK tactics. */
            tactics?: string;
            /** @description A semicolon-separated list of the data sources that provided information for this technique. */
            data_sources?: string;
            /** @description The total number of top attack paths in which this technique appears. */
            top_attack_path_count?: number;
            /** @description The total number of critical assets that could be compromised using this technique. */
            critical_assets_count?: number;
        };
        /** @description Defines a single filter condition used to narrow the search results for attack paths. */
        "Attack_Path_Exports_Attack-Path-Single-Filter": {
            /**
             * @description Specifies the property used to filter the results. For example: `priority`, `name`, or `technique`.
             * @enum {string}
             */
            property?: "priority" | "name" | "summary" | "steps" | "asset_exposure" | "blast_radius" | "asset_id" | "freetext" | "finding_id" | "technique" | "weakness_id" | "critical_asset" | "data_source" | "apa_aes" | "acr" | "path_status";
            /**
             * @description Specifies the comparison operator applied to the property filter. For example: `eq` (equals), `ne` (not equals), or `contains`.
             * @enum {string}
             */
            operator?: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains" | "in" | "not_in";
            /** @description Defines the specific value or values to match against the property. This can be a single value or an array of values depending on the operator used. */
            value?: string | string[] | number | number[] | (true | false);
        };
        /** @description Defines a compound filter that combines multiple conditions using logical operators. */
        "Attack_Path_Exports_Attack-Path-Multiple-Filters": {
            /**
             * @description Specifies the logical operator used to combine multiple filter conditions.
             * @default and
             * @enum {string}
             */
            operator: "and" | "or";
            /** @description Contains an array of filter objects. Each item can be a single filter condition or a nested operator object. */
            value: (components["schemas"]["Attack_Path_Exports_Attack-Path-Single-Filter"] | components["schemas"]["Attack_Path_Exports_Attack-Path-Multiple-Filters-Nested"])[];
        };
        /** @description Defines a nested logical operator used within a compound filter. This enables deep filtering logic while preventing circular references. */
        "Attack_Path_Exports_Attack-Path-Multiple-Filters-Nested": {
            /**
             * @description Specifies the logical operator used to combine the nested conditions.
             * @default and
             * @enum {string}
             */
            operator: "and" | "or";
            /** @description Contains an array of single filter conditions. */
            value: components["schemas"]["Attack_Path_Exports_Attack-Path-Single-Filter"][];
        };
        /** @description Defines a single filter condition used to narrow the search results for attack techniques. */
        "Attack_Path_Exports_Attack-Technique-Single-Filter": {
            /**
             * @description Specifies the property used to filter the results. For example: `priority`, `name`, or `last_updated_at`.
             * @enum {string}
             */
            property?: "priority" | "state" | "status" | "name" | "procedureName" | "mitre_id" | "tactics" | "target" | "source" | "cause" | "last_updated_at" | "created" | "serial_id";
            /**
             * @description Specifies the comparison operator applied to the property filter. For example: `eq` (equals), `ne` (not equals), or `contains`.
             * @enum {string}
             */
            operator?: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains" | "in" | "not_in";
            /** @description Defines the specific value or values to match against the property. This can be a single value or an array of values depending on the operator used. */
            value?: string | string[] | number | number[] | (true | false);
        };
        /**
         * AttackTechniqueFilterOperator
         * @description Defines a compound filter that combines multiple conditions using logical operators.
         */
        "Attack_Path_Exports_Attack-Technique-Multiple-Filters": {
            /**
             * @description Specifies the logical operator used to combine multiple filter conditions.
             * @enum {string}
             */
            operator: "and" | "or";
            /** @description Contains an array of filter objects. Each item can be a single filter condition or a nested operator object. */
            value: (components["schemas"]["Attack_Path_Exports_Attack-Technique-Single-Filter"] | components["schemas"]["Attack_Path_Exports_Attack-Technique-Multiple-Filters-Nested"])[];
        };
        /** @description Defines a nested logical operator used within a compound filter. This enables deep filtering logic while preventing circular references. */
        "Attack_Path_Exports_Attack-Technique-Multiple-Filters-Nested": {
            /**
             * @description Specifies the logical operator used to combine the nested conditions.
             * @enum {string}
             */
            operator?: "and" | "or";
            /** @description Contains an array of single filter conditions. */
            value: components["schemas"]["Attack_Path_Exports_Attack-Technique-Single-Filter"][];
        };
        /** @description Defines the sort order applied to the exported results. */
        Attack_Path_Exports_ExportSortParams: {
            /** @description Specifies the property used to sort the results. */
            property: string;
            /**
             * @description Specifies the sort direction, either ascending (`asc`) or descending (`desc`).
             * @enum {string}
             */
            direction: "asc" | "desc";
        };
        Attack_Path_Exports_ExportRequestId: {
            /**
             * Format: uuid
             * @description The unique identifier (UUID) for the export request. Use this ID to check the status of the export and download the results.
             */
            export_id?: string;
        };
        "Attack_Path_Exports_Response-Export-Status": {
            /**
             * Format: uuid
             * @description The unique identifier (UUID) for the export request. Use this ID to check the status of the export and download the results.
             */
            export_id?: string;
            /**
             * @description The current status of the export request. Possible values include:
             *
             *     * `QUEUED` — The request is waiting for earlier requests to complete.
             *     * `PROCESSING` — The system is currently processing the export request.
             *     * `FINISHED` — The system has completed processing the export request. The file is available for download.
             *     * `ERROR` — An error occurred while processing the export request. Retry the request; if the error persists, contact Tenable Support.
             *     * `CANCELLED` — The export request was cancelled.
             * @enum {string}
             */
            status?: "QUEUED" | "PROCESSING" | "FINISHED" | "ERROR" | "CANCELLED";
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time the export request was submitted.
             */
            submitted_at?: string;
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating when the export status was last updated. Compare this value with `submitted_at` to gauge total processing time.
             */
            last_refreshed_at?: string;
        };
        /**
         * @description Specifies the file format for the exported data.
         * @enum {string}
         */
        Attack_Path_Exports_FileFormat: "CSV" | "JSON";
        Attack_Path_Exports_ErrorResponse: {
            /** @description The HTTP status code of the error. */
            statusCode?: number;
            /** @description The standard HTTP error name. */
            error?: string;
            /** @description A brief message about the cause of the error. */
            message?: string;
        };
        Attack_Path_Exports_ErrorResponseStatus: {
            /** @description An error message indicating the invalid parameter or value. */
            message?: string;
            /** @description The HTTP response status code. */
            status?: number;
        };
        Exposure_View_ErrorResponse: {
            /** @description The HTTP status code of the error. */
            statusCode?: number;
            /** @description The standard HTTP error name. */
            error?: string;
            /** @description A brief message about the cause of the error. */
            message?: string;
        };
        "Exposure_View_ErrorResponse-404": {
            /** @description The HTTP status code of the error. */
            status?: number;
            /** @description The standard HTTP error name. */
            message?: string;
            error?: {
                /** @description The error code. For example, `UNEXPECTED_ERROR`. */
                code?: string;
                /** @description A brief message about the cause of the specific error. */
                message?: string;
            }[];
            /** @description The errors that caused the request to fail. */
            errors?: {
                /** @description The error code, for example `UNEXPECTED_ERROR`. */
                code?: string;
                /** @description A description of the error. */
                message?: string;
            }[];
        };
        "Exposure_View_Response-Search-Cards": {
            data?: components["schemas"]["Exposure_View_Response-Search-Cards-Object"][];
            pagination?: components["schemas"]["Exposure_View_PaginationResponseData"];
        };
        "Exposure_View_Response-Search-Cards-Object": {
            /** @description The unique ID of the exposure view card. */
            id?: string;
            /** @description The name of the exposure view card. */
            name?: string;
            card_type?: components["schemas"]["Exposure_View_CardType"];
            /** @description Indicates whether or not the exposure view card is a Tenable-provided global card (`true`) or a user-created custom card (`false`). */
            is_global_card?: boolean;
            /** @description The number of tags associated with the exposure view card. */
            tag_count?: number;
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time when the exposure view card was created.
             */
            created_at?: string;
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time when the exposure view card was last updated.
             */
            updated_at?: string;
            ces_score?: components["schemas"]["Exposure_View_CESScore"];
            /**
             * Format: double
             * @description The overall Service Level Agreement (SLA) percentage. SLA represents the acceptable time frame between when a finding is discovered and when it fixed or remediated. For information about how an SLA percentage is calculated, see the Remediation SLA section on the [Exposure View](https://docs.tenable.com/exposure-management/Content/exposure-management/exposure-view/exposure-view.htm) page in the _Tenable Exposure Management User Guide_.
             */
            sla_percentage?: number;
            /** @description An array of Cyber Exposure Score (CES) values along with their timestamps. */
            ces_trend?: components["schemas"]["Exposure_View_CESTrendDataPoint"][];
            exposure_class?: components["schemas"]["Exposure_View_ExposureClassArray"];
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time when the data for the exposure view card was last updated.
             */
            last_data_update_date?: string;
            sources?: components["schemas"]["Exposure_View_AssetSource"];
        };
        "Exposure_View_Response-Card-Details": {
            /** @description The unique ID of the exposure view card. */
            id?: string;
            /** @description The name of the exposure view card. */
            name?: string;
            card_type?: components["schemas"]["Exposure_View_CardType"];
            /** @description Indicates whether or not the exposure view card is a Tenable-provided global card (`true`) or a user-created custom card (`false`). */
            is_global_card?: boolean;
            ces_scores?: components["schemas"]["Exposure_View_CESScores"];
            /** @description An array of Cyber Exposure Score (CES) values along with their timestamps. */
            ces_trend?: components["schemas"]["Exposure_View_CESTrendDataPoint"][];
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time when the exposure view card was created.
             */
            created_at?: string;
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time when the exposure view card was last updated.
             */
            updated_at?: string;
            /** @description The number of tags associated with the exposure view card. */
            tag_count?: number;
            exposures?: components["schemas"]["Exposure_View_ExposureClassArray"];
            sources?: components["schemas"]["Exposure_View_AssetSource"];
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time when the data for the exposure view card was last updated.
             */
            last_data_update_date?: string;
            /** @description Metrics, breakdowns, and efficiency data for each exposure class. Exposure classes include `VM`, `WAS`, `CLOUD`, `OT`, `IDENTITY`, and `ALL`. For each exposure class, score benchmarks, asset risk breakdowns, score trend metrics, SLA efficiency, and SLA breakdowns are included. */
            exposure_classes_details?: {
                [key: string]: {
                    score_benchmark?: components["schemas"]["Exposure_View_Score-Benchmark"];
                    asset_risk_breakdown?: components["schemas"]["Exposure_View_Asset-Risk-Breakdown"];
                    score_trend_metric?: components["schemas"]["Exposure_View_Score-Trend-Metric"];
                    sla_efficiency?: components["schemas"]["Exposure_View_SeveritySummaryStat"][];
                    sla_breakdown?: components["schemas"]["Exposure_View_SLA-Breakdown"];
                };
            };
        };
        /** @description Data indicating how your Cyber Exposure Score (CES) compares to your industry and total population. */
        "Exposure_View_Score-Benchmark": {
            /** @description Data indicating how your Cyber Exposure Score (CES) compares to your industry. */
            industry_benchmark?: {
                /**
                 * Format: int32
                 * @description The numerical ID of the industry.
                 */
                industry_id?: number;
                ces_score?: components["schemas"]["Exposure_View_CESScore"];
            };
            population_benchmark?: components["schemas"]["Exposure_View_CESScore"];
        };
        "Exposure_View_SLA-Breakdown": {
            risk_distribution?: components["schemas"]["Exposure_View_SLAOverallRiskBreakdown"];
            risk_distribution_in_days?: {
                inside_sla?: number;
                outside_sla?: number;
            };
            exposure_category_breakdown?: components["schemas"]["Exposure_View_BusinessContextExposureClassDistribution"][];
            top_affecting_tags?: {
                id?: string;
                name?: string;
            }[];
        };
        /** @description The percentage of assets in each risk severity level. */
        "Exposure_View_Asset-Risk-Breakdown": {
            /**
             * Format: double
             * @description The percentage of your assets associated with vulnerabilities of critical severity.
             */
            critical?: number;
            /**
             * Format: double
             * @description The percentage of your assets associated with vulnerabilities of high severity.
             */
            high?: number;
            /**
             * Format: double
             * @description The percentage of your assets associated with vulnerabilities of medium or low severity.
             */
            medium_low?: number;
        };
        Exposure_View_PaginationResponseData: {
            /** @description The requested starting record of the result set to retrieve. Offsets are used to paginate through the result set. If this parameter is omitted, Tenable Exposure Management uses the default value of `0`. */
            offset?: number;
            /** @description The requested number of records to retrieve from the result set. The maximum value is `25`. If this parameter is omitted, Tenable Exposure Management uses the default value of `25`. */
            limit?: number;
            /** @description The total number of exposure view card records included in the result set of the search. */
            total_record_count?: number;
        };
        /**
         * @description The type of exposure view card. Global cards are Tenable-provided cards. Custom cards are user-created cards.
         * @enum {string}
         */
        Exposure_View_CardType: "GLOBAL" | "CATEGORY" | "EXPOSURE" | "CUSTOM";
        /** @description The numerical Cyber Exposure Score (CES) and its grade. */
        Exposure_View_CESScore: {
            /** @description An integer between 0 and 1000 indicating the Cyber Exposure Score (CES). For more information about CES and how it's calculated, see the Cyber Exposure Score (CES) section on the [Lumin Metrics](https://docs.tenable.com/vulnerability-management/Content/Lumin/LuminMetrics.htm) page in the _Tenable Vulnerability Management User Guide_. */
            score?: number;
            grade?: components["schemas"]["Exposure_View_CESGrade"];
        };
        Exposure_View_CESTrendDataPoint: {
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date of the Cyber Exposure Score (CES).
             */
            date?: string;
            /** @description An integer between 0 and 1000 indicating the Cyber Exposure Score (CES). For more information about CES and how it's calculated, see the Cyber Exposure Score (CES) section on the [Lumin Metrics](https://docs.tenable.com/vulnerability-management/Content/Lumin/LuminMetrics.htm) page in the _Tenable Vulnerability Management User Guide_. */
            ces_score?: number;
        };
        /**
         * @description The exposure class is determined by the sensor that assessed the asset or detected the finding. For more information about exposure classes, see [Scoring (Beta)](https://docs.tenable.com/tenableone/scoring-explained/Content/ScoringExplained/new-scoring.htm).
         * @enum {string}
         */
        Exposure_View_ExposureClass: "ALL" | "IDENTITY" | "WAS" | "VM" | "CLOUD" | "OT";
        /** @description The exposure class is determined by the sensor that assessed the asset or detected the finding. For more information about exposure classes, see [Scoring (Beta)](https://docs.tenable.com/tenableone/scoring-explained/Content/ScoringExplained/new-scoring.htm). */
        Exposure_View_ExposureClassArray: ("ALL" | "IDENTITY" | "WAS" | "VM" | "CLOUD" | "OT")[];
        /**
         * @description The Cyber Exposure Score (CES) grade as it compares to your industry and total population. For more information about CES grades, see [Exposure View](https://docs.tenable.com/exposure-management/Content/exposure-management/exposure-view/exposure-view.htm) in the _Tenable Exposure Management User Guide_.
         * @enum {string}
         */
        Exposure_View_CESGrade: "A" | "B" | "C" | "D" | "F" | "None";
        /** @description The sources that supply data for the card. */
        Exposure_View_AssetSource: ("ACUNETIX_360" | "ACUNETIX_PREMIUM" | "AQUA_CSPM" | "AQUA_CWPP" | "ARMIS" | "ASM" | "AWS" | "AWS_CONFIG" | "AWS_EC2" | "AWS_INSPECTOR_CLASSIC" | "AWS_INSPECTOR_V2" | "AWS_SECURITY_HUB" | "AXONIUS" | "AZURE" | "AZURE_FA" | "BIT_SIGHT" | "BURPSUITE" | "CARBON_BLACK" | "CLONE_SYSTEMS" | "CLOUD" | "CONSEC" | "CORE_CLOUDRESOURCE" | "CORTEX_XDR" | "CROWDSTRIKE" | "CROWDSTRIKE_ENTERPRISE" | "CYCOGNITO" | "DETECTIFY" | "FORTIFY_DAST" | "GCP" | "HACKER_ONE" | "INTUNE" | "JAMF" | "MICROSOFT_AZURE" | "MICROSOFT_DEFENDER" | "MICROSOFT_DEFENDER_CLOUD" | "MICROSOFT_TVM" | "NESSUS_AGENT" | "NESSUS_SCAN" | "NETSPARKER" | "NODE_ZERO" | "ORCA" | "OUTPOST24" | "PRISMACLOUD" | "PRISMACLOUD_CSPM" | "PURPLEMET" | "PVS" | "QUALYS" | "QUALYS_WAS" | "RAPID7_INSIGHT_APP_SEC" | "RAPID7_INSIGHTVM" | "RAPID7_INSIGHTVM_CLOUD" | "RAPID_7" | "RED_HAT_INSIGHTS" | "RISK_RECON" | "SECURITY_CENTER" | "SECURITY_SCORE_CARD" | "SENTINEL_ONE" | "SERVICE_NOW" | "SSM" | "T.CS" | "T.IO" | "T.OT" | "TANIUM" | "TIE AD" | "TIE MEID" | "TIE" | "UNCLASSIFIED" | "VERACODE_DAST" | "WAS" | "WHITEHAT" | "WIZ_CONFIGURATION" | "WIZ_ISSUES" | "WIZ_VULNERABILITY_MANAGEMENT")[];
        /** @description An object containing Cyber Exposure Scores (CES) per exposure, per tag, and total. */
        Exposure_View_CESScores: {
            /** @description An array of Cyber Exposure Scores (CES) per exposure. Both the exposure class and its associated score are indicated. */
            per_exposure?: {
                exposure_class?: components["schemas"]["Exposure_View_ExposureClass"];
                ces_score?: components["schemas"]["Exposure_View_CESScore"];
            }[];
            /** @description An array of Cyber Exposure Scores (CES) per tag. Both the tag and it's associated score are indicated. */
            per_tag?: {
                tag?: components["schemas"]["Exposure_View_Tag"];
                ces_score?: components["schemas"]["Exposure_View_CESScore"];
            }[];
            total?: components["schemas"]["Exposure_View_CESScore"];
        };
        /** @description Information about the tag associated with the exposure view card. */
        Exposure_View_Tag: {
            /** @description The unique ID of the tag. */
            id?: string;
            /** @description The name of the tag. */
            name?: string;
            /**
             * @description The origin product of the tag.
             * @enum {string}
             */
            origin?: "TENABLE_IO" | "TENABLE_AD" | "TENABLE_AI" | "TENABLE_WAS" | "TENABLE_CS" | "TENABLE_APA";
            /** @description The unique ID of the tag category to which the tag value belongs. */
            category_id?: string;
            /** @description The name of the tag category to which the tag value belongs. */
            category_name?: string;
            /** @description Indicates whether or not the tag is dynamic. Dynamic tags are tags that are automatically applied to assets based on defined tag rules. */
            dynamic?: boolean;
            /** @description The number of assets associated with the tag. */
            asset_count?: number;
            asset_query?: components["schemas"]["Exposure_View_AssetQueryV2"];
            /** @description The average Cyber Exposure Score (CES) for assets associated with the tag. CES is an integer between 0 and 1000. For more information about CES and how it's calculated, see [Lumin Metrics](https://docs.tenable.com/vulnerability-management/Content/Lumin/LuminMetrics.htm) in the _Tenable Vulnerability Management User Guide_. */
            avg_ces_score?: number;
        };
        /** @description For dynamic tags, the filters applied to define the tag rule. */
        Exposure_View_AssetQueryV2: {
            /** @description Indicates the tag filters and whether a logical `and` or `or` is applied. */
            filters_expression?: {
                /**
                 * @description The logical operators applied to the tag filters, either `and` or `or`.
                 * @enum {string}
                 */
                logical_operator?: "and" | "or";
                /** @description The tag filters applied to define the tag rule. */
                operands?: {
                    /** @description The property that was filtered on. */
                    property?: string;
                    /**
                     * @description The comparison operator to applied to the filter.
                     * @enum {string}
                     */
                    operator?: "eq" | "neq" | "lte" | "gte" | "lt" | "gt" | "wc" | "nwc" | "between" | ">" | ">=" | "=" | "!=" | "exists" | "nexists";
                    /** @description The values used for comparison in the filtering operation. */
                    value?: string[];
                }[];
            };
            /** @description Text search on asset names */
            text_query?: string;
            /** @enum {string} */
            mode?: "advanced" | "simple";
        };
        /** @enum {string} */
        Exposure_View_DataCategory: "GLOBAL" | "WEB_APPLICATIONS" | "COMPUTING_RESOURCES" | "IDENTITIES" | "CLOUD_RESOURCES" | "OPERATIONAL_TECH";
        /** @enum {string} */
        Exposure_View_SLASeverityLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "OVERALL";
        Exposure_View_BusinessContextDrivers: {
            top_affecting_tags?: components["schemas"]["Exposure_View_Tag"][];
            category_distribution?: components["schemas"]["Exposure_View_BusinessContextCategoryDistribution"][];
            exposure_class_distribution?: components["schemas"]["Exposure_View_BusinessContextExposureClassDistribution"][];
        };
        Exposure_View_BusinessContextExposureClassDistribution: {
            exposure_class?: components["schemas"]["Exposure_View_ExposureClass"];
            /** Format: double */
            contribution_percentage?: number;
        };
        Exposure_View_BusinessContextCategoryDistribution: {
            data_category?: components["schemas"]["Exposure_View_DataCategory"];
            /** Format: double */
            contribution_percentage?: number;
        };
        Exposure_View_SLAOverallRiskBreakdown: {
            risks_inside_sla?: components["schemas"]["Exposure_View_RiskBreakdownCategory"];
            risks_outside_sla?: components["schemas"]["Exposure_View_RiskBreakdownCategory"];
        };
        Exposure_View_RiskBreakdownCategory: {
            number_of_risks?: number;
            /** Format: double */
            percentage_of_total?: number;
            business_context?: components["schemas"]["Exposure_View_BusinessContextDrivers"];
        };
        Exposure_View_SeveritySummaryStat: {
            sla_severity_level?: components["schemas"]["Exposure_View_SLASeverityLevel"];
            /** Format: int32 */
            sla_inside_count?: number;
            /** Format: int32 */
            sla_total_count?: number;
            /** Format: double */
            sla_efficiency?: number;
            /** Format: double */
            sla_efficiency_target?: number;
        };
        /** @description An object containing Cyber Exposure Score (CES) trends over time, target scores, and events. */
        "Exposure_View_Score-Trend-Metric": {
            /** @description An array of Cyber Exposure Score (CES) values, grades, and timestamps to indicate how your score has trended over time. */
            ces_trend?: {
                /**
                 * Format: date-time
                 * @description A timestamp in ISO 8601 format indicating the date of the Cyber Exposure Score (CES).
                 */
                date?: string;
                ces_score?: components["schemas"]["Exposure_View_CESScore"];
            }[];
            /** @description Your baseline target. */
            target_score?: number;
            /** @description An object containing data about specific events that have contributed to your CES score. */
            events?: {
                /**
                 * Format: date-time
                 * @description A timestamp in ISO 8601 indicate the date and time of the event.
                 */
                timestamp?: string;
                /** @description A description of the event. */
                description?: string;
                event_detail?: {
                    /** @description The number of points the event affected your CES. */
                    affected_points?: number;
                    /** @description The risk category associated with the event. */
                    risk_categories?: components["schemas"]["Exposure_View_DataCategory"][];
                    exposure_classes?: components["schemas"]["Exposure_View_ExposureClassArray"];
                    description?: {
                        /** @description The numeric value of the rank. */
                        rank?: number;
                        /** @description The title of the change. */
                        change_title?: string;
                        /** @description The label for the change. */
                        change_label?: string;
                        /** @description The value before the change. */
                        value_before?: string;
                        /** @description The value before the change. */
                        value_after?: string;
                    };
                }[];
                /** @description A summary of the event. */
                executive_summary?: string;
            }[];
        };
        Inventory_ErrorResponse: {
            /** @description The HTTP status code of the error. */
            statusCode?: number;
            /** @description The standard HTTP error name. */
            error?: string;
            /** @description A brief message about the cause of the error. */
            message?: string;
        };
        "Inventory_ErrorResponse-400": {
            /** @description An error message indicating the invalid parameter or value. */
            message?: string;
            /** @description The HTTP response response status code. */
            status?: number;
        };
        /** @description An object containing a query and/or filters for a Tenable Exposure Management asset search. */
        "Inventory_Request-Search-Assets": {
            /** @description Filter the search results by query. A query consists of search mode and query text. */
            query?: {
                /**
                 * @description The mode to use for the query. You can choose either `simple` or `advanced`.
                 *     * `simple`—A simple query enables you to search for assets by asset name or asset ID.
                 *     * `advanced`—An advanced query enables you to build a specific query to search for assets.
                 * @default simple
                 * @enum {string}
                 */
                mode: "simple" | "advanced";
                /**
                 * @description For simple searches, either an asset name or an asset ID. For advanced searches, a query string. Advanced users can use the query builder in the user interface to create a query string.
                 *
                 *     For example, some common advanced queries are:
                 *
                 *     * Cloud assets with critical severity findings—`Assets HAS sources = "CLOUD" WITH Weakness HAS severity = "Critical"`
                 *     * Cloud assets with critical severity findings and AES score above 700—`Assets HAS sources = "CLOUD" AND aes >= 700 WITH Weakness HAS severity = "Critical"`
                 *     * Cloud assets exposing secrets and AES score above 700—`Assets HAS sources = "CLOUD" AND aes >= 700 WITH Weakness HAS detection_name contains "exposing secrets"`
                 *     * Account assets with critical weaknesses—`Assets as Account with weakness has severity_level >= 3`
                 *     * Assets discovered but not scanned for weaknesses—`Assets as Device has is_licensed = false and last_observed_at > "1988-01-01"`
                 * @example Microsoft
                 */
                text: string;
            };
            /**
             * @description A set of asset properties used to filter the search results.
             *
             *     Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to view available asset properties that can be used as filters.
             */
            filters?: {
                /**
                 * @description The asset property to filter on.
                 *
                 *     Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to retrieve a list of valid asset properties for filtering. For example, you might filter by `created_at`, `sources`, or `fqdns`.
                 */
                property: string;
                /**
                 * @description The comparison operator to apply to the filter.
                 *
                 *     For example: `=`, `!=`, `match`, etc. Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to retrieve supported comparison operators for the selected filter.
                 * @enum {string}
                 */
                operator: "=" | "!=" | "<=" | "between" | "match" | ">=" | "<" | ">" | "contains" | "not contains" | "exists" | "not exists" | "older than" | "newer than" | "within last";
                /**
                 * @description The value to use for comparison in the filter.
                 *
                 *     Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to retrieve the supported values for the selected filter.
                 */
                value: string[];
            }[];
        };
        /** @description An object specifying how the current result set is sorted, including the property by which the results were sorted and the sort direction. */
        "Inventory_Public-Sort-Object": {
            /** @description The property used to sort the results. */
            name?: string;
            /**
             * @description The sort direction for the results. `asc` for ascending or `desc` for descending.
             * @enum {string}
             */
            order?: "asc" | "desc";
        };
        /** @description The asset search results. */
        "Inventory_Response-Search-Assets": {
            data?: components["schemas"]["Inventory_Response-Search-Assets-Object"][];
            /** @description An object containing pagination information for the current result set. */
            pagination?: {
                /** @description The total number of assets included in the result set of the search. */
                total: number;
                /**
                 * Format: int32
                 * @description The requested starting record of the result set to retrieve. Offsets are used to paginate through the result set. If this parameter is omitted, Tenable Exposure Management uses the default value of `0`.
                 */
                offset: number;
                /**
                 * Format: int32
                 * @description The requested number of records to retrieve from the result set. The maximum value is `1000`. If this parameter is omitted, Tenable Exposure Management uses the default value of `1000`.
                 * @default 1000
                 */
                limit: number;
                sort: components["schemas"]["Inventory_Public-Sort-Object"];
            };
        };
        "Inventory_Response-Search-Assets-Object": {
            /** @description The unique identifier (UUID) of the asset in Tenable Exposure Management. Use this value as the unique key for the asset. */
            id: string;
            /**
             * @description The class that Tenable Exposure Management has assigned to the asset. Asset classes enable users to easily separate asset data based on its type. For more information about asset classes, see [Asset Classes](https://docs.tenable.com/exposure-management/Content/exposure-management/inventory/classes.htm) in the _Tenable Exposure Management User Guide_.
             * @enum {string}
             */
            asset_class: "ACCOUNT" | "APPLICATION" | "CONTAINER" | "DEVICE" | "GENERAL" | "GROUP" | "IAC" | "IDENTITY" | "RESOURCE" | "ROLE" | "STORAGE" | "UNKNOWN";
            /** @description The name of the asset. */
            name?: string;
            /** @description The Tenable-defined Asset Exposure Score (AES) for the asset. This metric weighs an asset's [Vulnerability Priority Rating (VPR)](https://docs.tenable.com/exposure-management/Content/exposure-management/getting-started/metrics.htm#Vulnerability-Priority-Rating-(VPR)) and [Asset Criticality Rating (AES)](https://docs.tenable.com/exposure-management/Content/exposure-management/getting-started/metrics.htm#Asset-Exposure-Score-(AES)) and then assigns a number from 1 to 1000, with higher numbers for more exposed assets. For more information, see [Tenable Exposure Management Metrics](https://docs.tenable.com/exposure-management/Content/exposure-management/getting-started/metrics.htm) in the _Tenable Exposure Management User Guide_. */
            aes?: number;
            /** @description The Tenable-defined Asset Criticality Rating (ACR) for the asset. With Lumin, Tenable uses an algorithm based on the [asset class](https://docs.tenable.com/exposure-management/Content/exposure-management/inventory/classes.htm) to assign a metric rating the importance of an asset to your organization from 1 to 10, with higher numbers for more critical assets. For more information, see [Tenable Exposure Management Metrics](https://docs.tenable.com/exposure-management/Content/exposure-management/getting-started/metrics.htm#Asset-Criticality-Rating-(ACR)) in the _Tenable Exposure Management User Guide_. */
            acr?: number;
            /**
             * @description Additional information about the assets as requested in the `extra_properties` parameter of the search request.
             *
             *     You can use the [List asset properties](ref:inventory-asset-properties-list) endpoint to retrieve a list of properties that can be used as values for the `extra_properties` parameter. For example, you may want to include `created_at`, `sources`, and `fqdns` as extra properties.
             */
            extra_properties?: Record<string, never>;
        };
        /** @description An object containing a query and/or filters for a Tenable Exposure Management finding search. */
        "Inventory_Request-Search-Findings": {
            /** @description Filter the search results by query. A query consists of search mode and query text. */
            query?: {
                /**
                 * @description The mode to use for the query. Currently, the findings search only supports the `simple` mode.
                 * @default simple
                 * @enum {string}
                 */
                mode: "simple";
                /**
                 * @description For simple searches, either a finding name or a finding ID. This parameter value can be left empty to search all software, for example `"text": ""`
                 * @example Microsoft
                 */
                text: string;
            };
            /**
             * @description A set of finding properties used to filter the search results.
             *
             *     Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to view available finding properties that can be used as filters.
             */
            filters?: {
                /**
                 * @description The finding property to filter on.
                 *
                 *      Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to retrieve a list of valid finding properties for filtering. For example, you might filter by `asset_name`, `solution`, or `vpr_score`.
                 */
                property: string;
                /**
                 * @description The comparison operator to apply to the filter.
                 *
                 *     For example: `=`, `!=`, `match`, etc. Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to retrieve supported comparison operators for the selected filter.
                 * @enum {string}
                 */
                operator: "=" | "!=" | "<=" | "between" | "match" | ">=" | "<" | ">" | "contains" | "not contains" | "exists" | "not exists" | "older than" | "newer than" | "within last";
                /**
                 * @description The value to use for comparison in the filter.
                 *
                 *      Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to retrieve the supported values for the selected filter.
                 */
                value: string[];
            }[];
        };
        /** @description The findings search results. */
        "Inventory_Response-Search-Findings": {
            data?: components["schemas"]["Inventory_Response-Search-Findings-Object"][];
            /** @description An object containing pagination information for the current result set. */
            pagination?: {
                /** @description The total number of findings included in the result set of the search. */
                total: number;
                /**
                 * Format: int32
                 * @description The requested starting record of the result set to retrieve. Offsets are used to paginate through the result set. If this parameter is omitted, Tenable Exposure Management uses the default value of `0`.
                 */
                offset: number;
                /**
                 * Format: int32
                 * @description The requested number of records to retrieve from the result set. The maximum value is `1000`. If this parameter is omitted, Tenable Exposure Management uses the default value of `1000`.
                 * @default 1000
                 */
                limit: number;
                sort: components["schemas"]["Inventory_Public-Sort-Object"];
            };
        };
        "Inventory_Response-Search-Findings-Object": {
            /** @description The unique identifier (UUID) of the finding in Tenable Exposure Management. Use this value as the unique key for the finding. */
            id?: string;
            /** @description The name of the finding. This typically corresponds with the plugin name that detected the finding. */
            name?: string;
            /** @description The unique identifier (UUID) of the asset on which the finding was identified. */
            asset_id?: string;
            /**
             * @description The current status of the finding.
             *
             *     The state of a finding reflects the current status of a security issue or vulnerability identified within your IT environment. It helps you track the progress of remediation efforts and provides insights into the overall security posture.
             *
             *     The following are the different states for findings in Tenable Exposure Management:
             *
             *     - **ACTIVE** — The finding is new or has not yet been addressed. It requires further investigation and potential remediation.
             *     - **RESURFACED**—The finding was fixed but got back.
             *     - **FIXED**—The issue identified in the finding has been successfully resolved.
             * @enum {string}
             */
            state?: "ACTIVE" | "RESURFACED" | "FIXED";
            /**
             * @description Indicates the level of risk posed to your organization. The severity of a finding, often referred to as vulnerability severity, is a classification that indicates the level of potential risk posed by a security vulnerability. It helps prioritize remediation efforts by highlighting the most critical vulnerabilities that require immediate attention.
             *
             *     Here's a breakdown of common severity levels and their implications:
             *
             *     - **CRITICAL**—Critically severe vulnerabilities pose an immediate and significant risk to your organization. They often allow for remote code execution, complete system compromise, or data breaches.
             *     - **HIGH**—High-severity vulnerabilities have a high likelihood of exploitation and could lead to significant damage or disruption.
             *     - **MEDIUM**—Medium-severity vulnerabilities may not be easily exploitable but still represent a potential security risk. They might require specific conditions or user interaction to be exploited.
             *     - **LOW**—Low-severity vulnerabilities pose a minimal risk to your organization. They might only result in minor inconveniences or limited impact.
             *     - **INFO**—Informational findings highlight potential security issues that do not directly pose a threat but could be leveraged in future attacks.
             * @enum {string}
             */
            severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
            /**
             * @description Additional information about the finding as requested in the `extra_properties` parameter of the search request.
             *
             *     You can use the [List finding properties](ref:inventory-finding-properties-list) endpoint to retrieve a list of properties that can be used as values for the `extra_properties` parameter. For example, you may want to include `asset_name`, `solution`, and `vpr_score` as extra properties.
             */
            extra_properties?: {
                [key: string]: unknown;
            };
        };
        /** @description An object containing a query and/or filters to search for installed software on your assets. */
        "Inventory_Request-Search-Software": {
            /** @description Filter the search results by query. A query consists of search mode and query text. */
            query?: {
                /**
                 * @description The mode to use for the query. Currently, the software search only supports the `simple` mode.
                 * @default simple
                 * @enum {string}
                 */
                mode: "simple";
                /**
                 * @description The application name or publisher to search for. This parameter value can be left empty to search all software, for example `"text": ""`
                 * @example Microsoft
                 */
                text: string;
            };
            /**
             * @description A set of software properties used to filter the search results.
             *
             *     Use the [List software properties](ref:inventory-software-properties-list) endpoint to view available software properties that can be used as filters.
             */
            filters?: {
                /**
                 * @description The software property to filter on.
                 *
                 *     Use the [List software properties](ref:inventory-software-properties-list) endpoint to retrieve a list of valid software properties for filtering. For example, you might filter by `cpe`, `version`, or `file_location`.
                 */
                property: string;
                /**
                 * @description The comparison operator to apply to the filter.
                 *
                 *     For example: `=`, `!=`, `match`, etc. Use the [List software properties](ref:inventory-software-properties-list) endpoint to retrieve supported comparison operators for the selected filter.
                 * @enum {string}
                 */
                operator: "=" | "!=" | "<=" | "between" | "match" | ">=" | "<" | ">" | "contains" | "not contains" | "exists" | "not exists" | "older than" | "newer than" | "within last";
                /**
                 * @description The value to use for comparison in the filter.
                 *
                 *      Use the [List software properties](ref:inventory-software-properties-list) endpoint to retrieve the supported values for the selected filter.
                 */
                value: string[];
            }[];
        };
        /** @description The software search results. */
        "Inventory_Response-Search-Software": {
            data?: components["schemas"]["Inventory_Response-Search-Software-Object"][];
            /** @description An object containing pagination information for the current result set. */
            pagination?: {
                /** @description The total number of software included in the result set of the search. */
                total: number;
                /**
                 * Format: int32
                 * @description The requested starting record of the result set to retrieve. Offsets are used to paginate through the result set. If this parameter is omitted, Tenable Exposure Management uses the default value of `0`.
                 */
                offset: number;
                /**
                 * Format: int32
                 * @description The requested number of records to retrieve from the result set. The maximum value is `1000`. If this parameter is omitted, Tenable Exposure Management uses the default value of `1000`.
                 * @default 1000
                 */
                limit: number;
                sort: components["schemas"]["Inventory_Public-Sort-Object"];
            };
        };
        "Inventory_Response-Search-Software-Object": {
            /** @description The most common and recognizable name or title of the installed software product. */
            application?: string;
            /** @description The company, organization, or person that manufactured or created the installed software product. */
            publisher?: string;
            /** @description The type of software, either application, operating system, or hardware. This value is decoded from CPE string position 2 referred to as "part" in the CPE specification. */
            type?: ("APPLICATION" | "OPERATING_SYSTEM" | "HARDWARE")[];
            /** @description The number of devices with the software installed. */
            devices_count?: number;
            /**
             * @description Additional information about the software as requested in the `extra_properties` parameter of the search request.
             *
             *     You can use the [List software properties](ref:inventory-software-properties-list) endpoint to retrieve a list of properties that can be used as values for the `extra_properties` parameter. For example, you may want to include `cpe`, `version`, and `file_location` as extra properties.
             */
            extra_properties?: Record<string, never>;
        };
        /** @enum {string} */
        Inventory_AssetClasses: "ACCOUNT" | "APPLICATION" | "CONTAINER" | "DEVICE" | "GENERAL" | "GROUP" | "IAC" | "IDENTITY" | "RESOURCE" | "ROLE" | "STORAGE" | "UNKNOWN";
        "Inventory_Properties-Object": {
            /** @description The unique property that can be used as a filter. */
            key?: string;
            /** @description The human-readable property name. */
            readable_name?: string;
            control?: components["schemas"]["Inventory_Control"];
            /** @description The logical operators that be used for the property filter. */
            operators?: ("=" | "!=" | "<=" | "between" | "match" | ">=" | "<" | ">" | "contains" | "not contains" | "exists" | "not exists" | "older than" | "newer than" | "within last")[];
            /** @description Indicates whether or not the property is sortable. */
            sortable?: boolean;
            /** @description Indicates whether or not the property is filterable. */
            filterable?: boolean;
            /** @description An AI-generated description of the property. */
            description?: string;
        };
        Inventory_Control: {
            /**
             * @description Indicates the data type of the property's value.
             * @enum {string}
             */
            type?: "STRING" | "NUMBER" | "DATE" | "BOOLEAN" | "ARRAY" | "OBJECT";
            /** @description Indicates whether or not the property can have multiple values. */
            multiple_allowed?: boolean;
            /** @description A list of possible values for the property if the property if multiple values are allowed. */
            selection?: {
                /** @description The human-readable name of the value. */
                name?: string;
                /** @description One possible value for the property. */
                value?: string;
                /** @description Indicates whether or not the value is deprecated. */
                deprecated?: boolean;
                /** @description Indicates whether or not the value is sourced from a third party. */
                third_party?: boolean;
            }[];
            regex?: {
                /** @description An example value. */
                hint?: string;
                /** @description Defines a regular expression matching the property's possible values. */
                expression?: string;
            };
        };
        Inventory_Exports_ErrorResponse: {
            /** @description The HTTP status code of the error. */
            statusCode?: number;
            /** @description The standard HTTP error name. */
            error?: string;
            /** @description A brief message about the cause of the error. */
            message?: string;
        };
        Inventory_Exports_ErrorResponseStatus: {
            /** @description An error message indicating the invalid parameter or value. */
            message?: string;
            /** @description The HTTP response response status code. */
            status?: number;
        };
        "Inventory_Exports_ErrorResponseStatus-400": {
            /** @description The HTTP response response status. */
            error?: string;
            /** @description An error message indicating the invalid parameter or value. */
            message?: string;
        };
        "Inventory_Exports_Response-Export-Status": {
            /**
             * Format: uuid
             * @description The unique identifier (UUID) of the export request.
             */
            export_id?: string;
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time the export request was submitted.
             */
            submitted_at?: string;
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time the export request was last checked for completion.
             */
            last_refreshed_at?: string;
            /**
             * @description The status of the export request. Possible values include
             *
             *      * `QUEUED`—Tenable Exposure Management has queued the export request until earlier requests have completed.
             *      * `PROCESSING`—Tenable Exposure Management is currently processing the export request.
             *      * `FINISHED`—Tenable Exposure Management has completed processing the export request. All chunks are available.
             *      * `ERROR`—An error occurred while processing the export request. Retry the request. If the error persists, contact Tenable Support.
             * @enum {string}
             */
            status?: "QUEUED" | "PROCESSING" | "FINISHED" | "ERROR";
            /** @description A list of completed chunk numbers available for download. Each integer represents a chunk file that can be downloaded. If no chunks are available, the list will be empty. */
            chunks_available?: number[];
        };
        "Inventory_Exports_Response-Export-Job": {
            /**
             * Format: uuid
             * @description The unique identifier (UUID) of the export request.
             */
            export_id?: string;
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time the export request was submitted.
             */
            submitted_at?: string;
            /**
             * Format: date-time
             * @description A timestamp in ISO 8601 format indicating the date and time the export request was last checked for completion.
             */
            last_refreshed_at?: string;
            /**
             * @description The status of the export request. Possible values include
             *
             *      * QUEUED—The request is waiting for earlier requests to complete.
             *      * PROCESSING—The request is currently being processed.
             *      * FINISHED—Processing is complete, and all chunks are available.
             *      * ERROR—An error occurred while processing. Retry the request, and if the issue persists, contact Tenable Support.
             * @enum {string}
             */
            status?: "QUEUED" | "PROCESSING" | "FINISHED" | "ERROR";
            /**
             * @description The type of export request. Possible values are `assets` or `findings`.
             * @enum {string}
             */
            export_type?: "assets" | "findings";
        };
        "Inventory_Exports_Response-Assets-Chunk-JSON": {
            /** @description The Tenable-defined Asset Exposure Score (AES) for the asset. This metric weighs an asset's [Vulnerability Priority Rating (VPR)](https://docs.tenable.com/exposure-management/Content/exposure-management/getting-started/metrics.htm#Vulnerability-Priority-Rating-(VPR)) and [Asset Criticality Rating (AES)](https://docs.tenable.com/exposure-management/Content/exposure-management/getting-started/metrics.htm#Asset-Exposure-Score-(AES)) and then assigns a number from 1 to 1000, with higher numbers for more exposed assets. For more information, see [Tenable Exposure Management Metrics](https://docs.tenable.com/exposure-management/Content/exposure-management/getting-started/metrics.htm) in the _Tenable Exposure Management User Guide_. */
            aes?: number;
            /**
             * @description The class that Tenable Exposure Management has assigned to the asset. Asset classes enable users to easily separate asset data based on its type. For more information about asset classes, see [Asset Classes](https://docs.tenable.com/exposure-management/Content/exposure-management/inventory/classes.htm) in the _Tenable Exposure Management User Guide_.
             * @enum {string}
             */
            asset_class?: "ACCOUNT" | "APPLICATION" | "CONTAINER" | "DEVICE" | "GENERAL" | "GROUP" | "IAC" | "IDENTITY" | "RESOURCE" | "ROLE" | "STORAGE" | "UNKNOWN";
            /** @description The Tenable-defined Asset Criticality Rating (ACR) for the asset. With Lumin, Tenable uses an algorithm based on the [asset class](https://docs.tenable.com/exposure-management/Content/exposure-management/inventory/classes.htm) to assign a metric rating the importance of an asset to your organization from 1 to 10, with higher numbers for more critical assets. For more information, see [Tenable Exposure Management Metrics](https://docs.tenable.com/exposure-management/Content/exposure-management/getting-started/metrics.htm#Asset-Criticality-Rating-(ACR)) in the _Tenable Exposure Management User Guide_. */
            "asset_criticality_rating_(acr)"?: number;
            /** @description The unique identifier (UUID) of the asset in Tenable Exposure Management. Use this value as the unique key for the asset. */
            asset_id?: string;
            /** @description The name of the asset. */
            asset_name?: string;
        } & {
            [key: string]: unknown;
        };
        "Inventory_Exports_Response-Findings-Chunk-JSON": {
            /** @description The unique identifier (UUID) of the asset on which the finding was identified. */
            asset_id?: string;
            /** @description The unique identifier (UUID) of the finding in Tenable Exposure Management. Use this value as the unique key for the finding. */
            finding_id?: string;
            /** @description The name of the finding. This typically corresponds with the plugin name that detected the finding. */
            finding_name?: string;
            /**
             * @description Indicates the level of risk posed to your organization. The severity of a finding, often referred to as vulnerability severity, is a classification that indicates the level of potential risk posed by a security vulnerability. It helps prioritize remediation efforts by highlighting the most critical vulnerabilities that require immediate attention.
             *
             *     Here's a breakdown of common severity levels and their implications:
             *
             *     - **CRITICAL**—Critically severe vulnerabilities pose an immediate and significant risk to your organization. They often allow for remote code execution, complete system compromise, or data breaches.
             *     - **HIGH**—High-severity vulnerabilities have a high likelihood of exploitation and could lead to significant damage or disruption.
             *     - **MEDIUM**—Medium-severity vulnerabilities may not be easily exploitable but still represent a potential security risk. They might require specific conditions or user interaction to be exploited.
             *     - **LOW**—Low-severity vulnerabilities pose a minimal risk to your organization. They might only result in minor inconveniences or limited impact.
             *     - **INFO**—Informational findings highlight potential security issues that do not directly pose a threat but could be leveraged in future attacks.
             * @enum {string}
             */
            severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
            /**
             * @description The current status of the finding.
             *
             *     The state of a finding reflects the current status of a security issue or vulnerability identified within your IT environment. It helps you track the progress of remediation efforts and provides insights into the overall security posture.
             *
             *     The following are the different states for findings in Tenable Exposure Management:
             *
             *     - **ACTIVE** — The finding is new or has not yet been addressed. It requires further investigation and potential remediation.
             *     - **RESURFACED**—The finding was fixed but got back.
             *     - **FIXED**—The issue identified in the finding has been successfully resolved.
             * @enum {string}
             */
            state?: "ACTIVE" | "RESURFACED" | "FIXED";
        } & {
            [key: string]: unknown;
        };
        "Inventory_Exports_Assets-Property-Filter": {
            /**
             * @description The asset property to filter on.
             *
             *     Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to retrieve a list of valid asset properties for filtering. For example, you might filter by `created_at`, `sources`, or `fqdns`.
             */
            property: string;
            /**
             * @description The comparison operator to apply to the filter.
             *
             *     For example: `=`, `!=`, `match`, etc. Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to retrieve supported comparison operators for the selected filter.
             * @enum {string}
             */
            operator: "" | "=" | "!=" | "<=" | "between" | "match" | ">=" | "<" | ">" | "contains" | "not contains" | "exists" | "not exists" | "older than" | "newer than" | "within last";
            /**
             * @description The value to use for comparison in the filter.
             *
             *     Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to retrieve the supported values for the selected filter.
             */
            value: string[];
        };
        "Inventory_Exports_Findings-Property-Filter": {
            /**
             * @description The finding property to filter on.
             *
             *      Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to retrieve a list of valid finding properties for filtering. For example, you might filter by `asset_name`, `solution`, or `vpr_score`.
             */
            property: string;
            /**
             * @description The comparison operator to apply to the filter.
             *
             *     For example: `=`, `!=`, `match`, etc. Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to retrieve supported comparison operators for the selected filter.
             * @enum {string}
             */
            operator: "" | "=" | "!=" | "<=" | "between" | "match" | ">=" | "<" | ">" | "contains" | "not contains" | "exists" | "not exists" | "older than" | "newer than" | "within last";
            /**
             * @description The value to use for comparison in the filter.
             *
             *      Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to retrieve the supported values for the selected filter.
             */
            value: string[];
        };
        /**
         * @default JSON
         * @enum {string}
         */
        "Inventory_Exports_Dataset-File-Format": "CSV" | "JSON";
        /** @description An object containing a query and/or filters to search for tags. */
        "Inventory_Request-Search-Tags": {
            /** @description The search mode and query text. */
            query?: {
                /**
                 * @description The mode to use for the query. Currently, the tag search only supports the `simple` mode.
                 * @default simple
                 * @enum {string}
                 */
                mode: "simple";
                /**
                 * @description The tag category or tag value to search for. This parameter value can be left empty to search all tags, for example `"text": ""`
                 * @example Microsoft
                 */
                text: string;
            };
            /**
             * @description A set of tag properties used to filter the search results.
             *
             *     Use the [List tag properties](ref:inventory-tag-properties-list) endpoint to view available tag properties that can be used as filters.
             */
            filters?: {
                /**
                 * @description The tag property to filter on.
                 *
                 *      Use the [List tag properties](ref:inventory-tag-properties-list) endpoint to retrieve a list of valid tag properties for filtering. For example, you might filter by `tag_data_source`, `last_updated`, or `tag_created_by_id`.
                 */
                property: string;
                /**
                 * @description The comparison operator to apply to the filter.
                 *
                 *      For example: `=`, `!=`, `match`, etc. Use the [List tag properties](ref:inventory-tag-properties-list) endpoint to retrieve supported comparison operators for the selected filter.
                 * @enum {string}
                 */
                operator: "=" | "!=" | "<=" | "between" | "match" | ">=" | "<" | ">" | "contains" | "not contains" | "exists" | "not exists" | "older than" | "newer than" | "within last";
                /**
                 * @description The value to use for comparison in the filter.
                 *
                 *      Use the [List tag properties](ref:inventory-software-properties-list) endpoint to retrieve the supported values for the selected filter.
                 */
                value: string[];
            }[];
        };
        /** @description The tag search results. */
        "Inventory_Response-Search-Tags": {
            data?: components["schemas"]["Inventory_Response-Search-Tags-Object"][];
            /** @description An object containing pagination information for the current result set. */
            pagination?: {
                /** @description The total number of tags included in the result set of the search. */
                total: number;
                /**
                 * Format: int32
                 * @description The requested starting record of the result set to retrieve. Offsets are used to paginate through the result set. If this parameter is omitted, Tenable Exposure Management uses the default value of `0`.
                 */
                offset: number;
                /**
                 * Format: int32
                 * @description The requested number of records to retrieve from the result set. The maximum value is `1000`. If this parameter is omitted, Tenable Exposure Management uses the default value of `1000`.
                 * @default 1000
                 */
                limit: number;
                sort: components["schemas"]["Inventory_Public-Sort-Object"];
            };
        };
        "Inventory_Response-Search-Tags-Object": {
            /**
             * Format: uuid
             * @description The unique ID (UUID) of the tag.
             */
            id?: string;
            /** @description The name of the tag. */
            name?: string;
            /**
             * @description The Tenable product associated with the tag.
             * @enum {string}
             */
            product?: "TENABLE_IO" | "TENABLE_AD" | "TENABLE_AI" | "TENABLE_WAS" | "TENABLE_CS" | "TENABLE_APA";
            /**
             * Format: int32
             * @description The total number of assets that are associated with the tag.
             */
            asset_count?: number;
            /** @description The total number of weaknesses associated with the tag by severity levels. This structure is applicable only for Tenable Vulnerability Management, Tenable Web App Scanning, Tenable Cloud Exposure, Tenable Identity Exposure, and Tenable OT Exposure assets. */
            weakness_severity_counts?: {
                /**
                 * Format: int32
                 * @description The total number of low severity weaknesses.
                 */
                low?: number;
                /**
                 * Format: int32
                 * @description The total number of medium severity weaknesses.
                 */
                medium?: number;
                /**
                 * Format: int32
                 * @description The total number of high severity weaknesses.
                 */
                high?: number;
                /**
                 * Format: int32
                 * @description The total number of critical severity weaknesses.
                 */
                critical?: number;
                /**
                 * Format: int32
                 * @description The total number of all weaknesses.
                 */
                total?: number;
            };
            /**
             * Format: int32
             * @description The total number of weaknesses.
             */
            total_weakness_count?: number;
            /** @description The type of tag, either `DYNAMIC` or `STATIC`. Dynamic tags are tags that are automatically applied to assets based on defined tag rules. Static tags are tags that are applied manually. */
            type?: string;
            /**
             * @description Additional information about the software as requested in the `extra_properties` parameter of the search request.
             *
             *     You can use the [List tag properties](ref:inventory-tag-properties-list) endpoint to retrieve a list of properties that can be used as values for the `extra_properties` parameter. For example, you may want to include `tag_data_source`, `last_updated`, and `tag_created_by_id` as extra properties.
             */
            extra_properties?: Record<string, never>;
        };
    };
    responses: never;
    parameters: {
        /**
         * @description Filters the results by export job status.
         *
         *     Supported values include:
         *
         *      * `QUEUED`—The request is waiting for earlier requests to complete.
         *      * `PROCESSING`—The request is currently being processed.
         *      * `FINISHED`—Processing is complete, and all chunks are available.
         *      * `ERROR`—An error occurred while processing. Retry the request, and if the issue persists, contact Tenable Support.
         */
        "Inventory_Exports_status-query-param": "QUEUED" | "PROCESSING" | "FINISHED" | "ERROR";
        /**
         * @description The maximum number of export jobs to return from the last 3 days.
         *
         *     **Note:** Only jobs submitted within the last 3 days are returned. The actual number of results may be less than the specified limit if fewer jobs exist.
         *
         *     If omitted, the default is `1000`. The maximum value is `1000` and the minimum value is `1`.
         * @example 100
         */
        "Inventory_Exports_limit-query-param": number;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "apa-attack-paths-search": {
        parameters: {
            query?: {
                /** @description The number of attack path records to retrieve. If omitted, the default value is `1000`. The minimum value is `100` and the maximum value is `10000`. */
                limit?: number;
                /** @description The number of records to skip for offset-based pagination. If omitted, the default value is `0`. */
                offset?: number;
                /**
                 * @description The property and direction to sort the results by, in the format `property:direction`. For example: `name:asc`, `priority:desc`, or `path_status:asc`.
                 *
                 *     Supported properties for sorting include `name`, `priority`, and `path_status`.
                 * @example priority:desc
                 */
                sort?: string;
                /**
                 * @description Indicates whether or not to run the AI summarization for missing paths.
                 *
                 *     Generative AI enables users to better understand attack paths and their associated risk, and it provides additional insight into the assets affected by the attack paths.
                 *
                 *     Note that enabling the AI summarization results in slower response times.
                 */
                run_ai_summarization?: "true" | "false";
                /**
                 * @description Excludes resolved attack paths from the results. When `true` (default), the system filters out paths with the following `path_status` values:
                 *
                 *     * `done` — Remediation is complete.
                 *     * `chain_prevented` — The attack chain is partially broken.
                 *     * `accepted` — The risk is accepted.
                 *
                 *     Set to `false` to include all attack paths regardless of status.
                 */
                exclude_resolved?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Filter conditions for searching attack paths. Filter operators can include nested conditions and operators to create complex filtering logic. */
        requestBody?: {
            content: {
                "application/json": components["schemas"]["Attack_Path_Attack-Path-Single-Filter"] | components["schemas"]["Attack_Path_Attack-Path-Multiple-Filters"];
            };
        };
        responses: {
            /** @description Returned if the attack path search results were retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_DiscoverPageTableResponse"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_ErrorResponse"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to search attack paths. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_ErrorResponse"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_ErrorResponse"];
                };
            };
        };
    };
    "apa-attack-techniques-search": {
        parameters: {
            query?: {
                /** @description The number of attack technique records to retrieve. If omitted, the default value is `1000`. The minimum value is `100` and the maximum value is `10000`. */
                limit?: number;
                /** @description The number of records to skip for offset-based pagination. If omitted, the default value is `0`. */
                offset?: number;
                /**
                 * @description The property and direction to sort the results by, in the format `property:direction`. For example: `name:asc` or `priority:desc`.
                 *
                 *     Supported properties for sorting include `last_updated_at`, `priority`, `mitre_id`, `name`, `technique_name`, `status`, `state`, and `vector_ount`.
                 * @example priority:desc
                 */
                sort?: string;
                /**
                 * @description Excludes resolved attack techniques from the results. When `true` (default), the system filters out techniques with the following values:
                 *
                 *     * Status — `done`, `accepted`
                 *     * State — `archive`
                 *
                 *     Set to `false` to include all techniques regardless of status or state.
                 */
                exclude_resolved?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Filter conditions for searching attack techniques. Filter operators can include nested conditions and operators to create complex filtering logic. */
        requestBody?: {
            content: {
                "application/json": components["schemas"]["Attack_Path_Attack-Technique-Single-Filter"] | components["schemas"]["Attack_Path_Attack-Technique-Multiple-Filters"];
            };
        };
        responses: {
            /** @description Returned if the attack technique search results were retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_AttackTechniquesSearchResponse"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_ErrorResponse"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to search attack techniques. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_ErrorResponse"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_ErrorResponse"];
                };
            };
        };
    };
    "connectors-logs": {
        parameters: {
            query?: {
                /** @description Filters logs by a connector's unique numeric identifier. */
                connector_id?: number;
                /** @description Filters logs by sync status. Supported values are `SUCCEEDED` or `FAILED`. */
                status?: components["schemas"]["Connectors_SyncStatus"];
                /**
                 * @description Filters logs by syncs that started on or after the specified date. This boundary is inclusive. Format: `YYYY-MM-DD`.
                 *
                 *     **Note:** Must be used together with `end_date`. If you specify one of `start_date` or `end_date`, you must specify both.
                 */
                start_date?: string;
                /**
                 * @description Filters logs by syncs that started before the specified date. This boundary is exclusive, so the specified date itself is not included. Format: `YYYY-MM-DD`.
                 *
                 *     **Note:** Must be used together with `start_date`. If you specify one of `start_date` or `end_date`, you must specify both.
                 */
                end_date?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if Tenable One successfully retrieved the list of connector sync logs. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Connectors_Response-Get-Sync-Logs"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Connectors_ErrorResponse-400"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Connectors_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view sync logs. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if a parameter in your request failed validation. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Connectors_ErrorResponse-422"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Connectors_ErrorResponse"];
                };
            };
        };
    };
    "apa-export-attack-path": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Attack_Path_Exports_Request-Export-Attack-Paths"];
            };
        };
        responses: {
            /** @description Returned if the attack path export request was successfully queued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ExportRequestId"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to export attack paths. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if the attack path export feature is not enabled for your account. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
        };
    };
    "apa-export-attack-technique": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Attack_Path_Exports_Request-Export-Attack-Techniques"];
            };
        };
        responses: {
            /** @description Returned if the attack technique export request was successfully queued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ExportRequestId"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to export attack techniques. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if the attack path export feature is not enabled for your account. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
        };
    };
    "apa-export-mitre-heatmap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Attack_Path_Exports_Request-Export-Mitre-Heatmap"];
            };
        };
        responses: {
            /** @description Returned if the MITRE heatmap export request was successfully queued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ExportRequestId"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to export MITRE heatmap data. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if the MITRE heatmap export feature is not enabled for your account. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
        };
    };
    "apa-export-status": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Specifies the unique identifier (UUID) of the export request. */
                export_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the status of the specified export request was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_Response-Export-Status"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view the export status. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if specified export request was not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if the attack path export feature is not enabled for your account. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
        };
    };
    "apa-export-download": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Specifies the unique identifier (UUID) of the export request. */
                export_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the specified export file was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": components["schemas"]["Attack_Path_Exports_AttackPathExportRecord"][] | string | components["schemas"]["Attack_Path_Exports_AttackTechniqueExportRecord"][] | components["schemas"]["Attack_Path_Exports_MitreHeatmapNavigatorLayer"];
                };
            };
            /** @description Returned if the specified export is not yet ready for download. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to download exports. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if the specified export request was not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if the attack path export feature is not enabled for your account. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Attack_Path_Exports_ErrorResponse"];
                };
            };
        };
    };
    "exposure-view-cards-search": {
        parameters: {
            query?: {
                /**
                 * @description Indicates whether or not to return Tenable-provided global cards or user-created custom cards.
                 *
                 *     If `true`, only Tenable-provided global cards are returned. If `false`, only user-created custom cards are returned. If this parameter is omitted, Tenable Exposure Management returns all cards.
                 */
                is_global_card?: boolean;
                /** @description Filters the results by card name. */
                text_query?: string;
                /** @description The order to sort the results by, either ascending (`asc`) or descending (`desc`). */
                sorting_order?: "asc" | "desc";
                /** @description The number of card records to retrieve. The maximum value is `25`. If this parameter is omitted, Tenable Exposure Management uses the default value of `25`. */
                limit?: number;
                /** @description The starting record to retrieve. If this parameter is omitted, Tenable Exposure Management uses the default value of `0`. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the list of exposure view cards was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Exposure_View_Response-Search-Cards"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Exposure_View_ErrorResponse"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Exposure_View_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to search exposure view cards. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Exposure_View_ErrorResponse"];
                };
            };
        };
    };
    "exposure-view-card-details": {
        parameters: {
            query?: {
                /**
                 * @description The start date for trend data. Use this parameter in combination with the `trend_end_date` parameter to define the time frame for the trend data.
                 *
                 *     The date must be specified as a UTC timestamp in ISO 8601 format (e.g., `2025-06-28T00:00:00.000Z`).
                 */
                trend_start_date?: string;
                /**
                 * @description The end date for trend data. Use this parameter in combination with the `trend_start_date` parameter to define the time frame for the trend data.
                 *
                 *     The date must be specified as a UTC timestamp in ISO 8601 format (e.g., `2025-06-28T00:00:00.000Z`).
                 */
                trend_end_date?: string;
                /**
                 * @description The start date for SLA efficiency data. Use this parameter in combination with the `sla_efficiency_end_date` parameter to define the time frame for the SLA efficiency.
                 *
                 *     The date must be specified as a UTC timestamp in ISO 8601 format (e.g., `2025-06-28T00:00:00.000Z`).
                 */
                sla_efficiency_start_date?: string;
                /**
                 * @description The end date for SLA efficiency data. Use this parameter in combination with the `sla_efficiency_start_date` parameter to define the time frame for the SLA efficiency.
                 *
                 *     The date must be specified as a UTC timestamp in ISO 8601 format (e.g., `2025-06-28T00:00:00.000Z`).
                 */
                sla_efficiency_end_date?: string;
                /** @description Filter SLA breakdown data by `REMEDIATED`, `NON_REMEDIATED`, or `ANY`. */
                sla_breakdown_filter?: "ANY" | "REMEDIATED" | "NON_REMEDIATED";
                /** @description Indicates whether or not to include trend events. */
                include_trend_events?: boolean;
            };
            header?: never;
            path: {
                /** @description The unique ID of the card to retrieve details for. */
                card_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the data for the specified exposure view card was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Exposure_View_Response-Card-Details"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Exposure_View_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to retrieve the specified exposure view card. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if the specified exposure view card was not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Exposure_View_ErrorResponse-404"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Exposure_View_ErrorResponse"];
                };
            };
        };
    };
    "inventory-assets-search": {
        parameters: {
            query?: {
                /**
                 * @description Specifies extra asset properties to include in the search results. You can provide multiple properties as a comma-separated list.
                 *
                 *     Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to retrieve a list of valid properties for this parameter. For example, you might include `created_at`, `sources`, and `fqdns` as extra properties.
                 */
                extra_properties?: string;
                /** @description The starting record to retrieve. If omitted, the default value is `0`. */
                offset?: number;
                /** @description The number of records to retrieve. If omitted, the default value is `1000`. The maximum value is `1000`. */
                limit?: number;
                /**
                 * @description The property and direction to sort the results by, in the format `property:direction`. For example: `asset_name:asc` or `acr:desc`
                 * @example acr:desc
                 */
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Inventory_Request-Search-Assets"];
            };
        };
        responses: {
            /** @description Returned if the list of assets was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Response-Search-Assets"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse-400"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to search assets. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
        };
    };
    "inventory-findings-search": {
        parameters: {
            query?: {
                /**
                 * @description Specifies extra findings properties to include in the search results. You can provide multiple properties as a comma-separated list.
                 *
                 *     Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to retrieve a list of valid properties for this parameter. For example, you might include `asset_name`, `solution`, and `vpr_score` as extra properties.
                 */
                extra_properties?: string;
                /** @description The starting record to retrieve. If omitted, the default value is `0`. */
                offset?: number;
                /** @description The number of records to retrieve. If omitted, the default value is `1000`. The maximum value is `10000`. */
                limit?: number;
                /**
                 * @description The property and direction to sort the results by, in the format `property:direction`. For example: `finding_name:asc` or `severity:desc`
                 * @example severity:desc
                 */
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Inventory_Request-Search-Findings"];
            };
        };
        responses: {
            /** @description Returned if the list of findings was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Response-Search-Findings"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse-400"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to search findings. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
        };
    };
    "inventory-software-search": {
        parameters: {
            query?: {
                /**
                 * @description Specifies extra software properties include in the search results. You can provide multiple properties as a comma-separated list.
                 *
                 *     Use the [List software properties](ref:inventory-software-properties-list) endpoint to retrieve a list of valid properties for this parameter. For example, you might include `cpe`, `version`, and `file_location` as extra properties.
                 */
                extra_properties?: string;
                /** @description The starting record to retrieve. If omitted, the default value is `0`. */
                offset?: number;
                /** @description The number of records to retrieve. If omitted, the default value is `1000`. The maximum value is `1000`. */
                limit?: number;
                /**
                 * @description The property and direction to sort the results by, in the format `property:direction`. For example: `application:asc` or `version:desc`
                 * @example application:asc
                 */
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Inventory_Request-Search-Software"];
            };
        };
        responses: {
            /** @description Returned if the list of installed software was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Response-Search-Software"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse-400"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to search software. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
        };
    };
    "inventory-asset-properties-list": {
        parameters: {
            query?: {
                /**
                 * @description The asset classes you want to retrieve property filters for. If this parameter is omitted, Tenable Exposure Management returns property filters for all asset classes.
                 *
                 *     Asset classes enable users to easily separate asset data based on its type. For more information about asset classes, see [Asset Classes](https://docs.tenable.com/exposure-management/Content/exposure-management/inventory/classes.htm) in the _Tenable Exposure Management User Guide_.
                 */
                asset_classes?: components["schemas"]["Inventory_AssetClasses"][];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the list of asset properties was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        properties?: components["schemas"]["Inventory_Properties-Object"][];
                    };
                };
            };
            /** @description Returned if your request specified an invalid asset class, if your request specified invalid parameters, or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description An error message indicating the invalid asset class or classes. */
                        error?: string;
                    };
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view the list of asset properties. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
        };
    };
    "inventory-finding-properties-list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the list of finding properties was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Inventory_Properties-Object"][];
                    };
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view the list of finding properties. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
        };
    };
    "inventory-software-properties-list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the list of software properties was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Inventory_Properties-Object"][];
                    };
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view the list of software properties. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
        };
    };
    "inventory-export-assets": {
        parameters: {
            query?: {
                /**
                 * @description Specifies which asset properties to include in the export. Provide multiple properties as a comma-separated list.
                 *
                 *     By default, if no properties are provided, the export includes the following properties: `asset_name`, `asset_id`, `asset_class`, `aes`, and `asset_criticality_rating_(acr)`
                 *
                 *     Use the [List assets properties](ref:inventory-asset-properties-list) endpoint to retrieve a list of valid properties for this parameter. For example, you might include `created_at`, `sources`, and `fqdns`.
                 */
                properties?: string;
                /** @description When set to `true`, returns the human-readable names of properties instead of internal key names. */
                use_readable_name?: boolean;
                /**
                 * @description Maximum size, in bytes, for each export chunk when exporting large datasets.
                 *
                 *     If omitted, the default is `20971520` bytes (20 MB). The maximum value is `104857600` (100 MB) and the minimum value is `5242880` (5 MB).
                 */
                max_chunk_file_size?: number;
                /**
                 * @description The property and direction to sort the results by, in the format `property:direction`. For example: `asset_name:asc` or `acr:desc`
                 * @example acr:desc
                 */
                sort?: string;
                /**
                 * @description Specifies the file format for the export.
                 *
                 *     Defaults to `JSON` if not provided. Valid values are `CSV` and `JSON`.
                 * @example CSV
                 */
                file_format?: components["schemas"]["Inventory_Exports_Dataset-File-Format"];
                /**
                 * @description When set to `true`, the exported file is compressed using GZIP.
                 *
                 *     The compressed file retains its original format (CSV or JSON) but is smaller in size, which helps reduce download time and storage requirements. You must decompress the file with a standard GZIP tool before processing. This option is particularly useful for large exports or limited-bandwidth environments.
                 * @example true
                 */
                compress?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /**
                     * @description A set of asset properties used to filter the export results.
                     *
                     *     Use the [List asset properties](ref:inventory-asset-properties-list) endpoint to view available asset properties that can be used as filters.
                     */
                    filters?: components["schemas"]["Inventory_Exports_Assets-Property-Filter"][] | null;
                    /** @description Filter the export results by query. A query consists of the search mode and query text. */
                    query?: {
                        /**
                         * @description The mode to use for the query. You can choose either `simple` or `advanced`.
                         *     * `simple`—A simple query enables you to search for assets by asset name or asset ID.
                         *     * `advanced`—An advanced query enables you to build a specific query to search for assets.
                         * @default simple
                         * @enum {string}
                         */
                        mode: "simple" | "advanced";
                        /**
                         * @description For simple searches, either an asset name or an asset ID. For advanced searches, a query string. Advanced users can use the query builder in the user interface to create a query string.
                         *
                         *     For example, some common advanced queries are:
                         *
                         *     * Cloud assets with critical severity findings—`Assets HAS sources = "CLOUD" WITH Weakness HAS severity = "Critical"`
                         *     * Cloud assets with critical severity findings and AES score above 700—`Assets HAS sources = "CLOUD" AND aes >= 700 WITH Weakness HAS severity = "Critical"`
                         *     * Cloud assets exposing secrets and AES score above 700—`Assets HAS sources = "CLOUD" AND aes >= 700 WITH Weakness HAS detection_name contains "exposing secrets"`
                         *     * Account assets with critical weaknesses—`Assets as Account with weakness has severity_level >= 3`
                         *     * Assets discovered but not scanned for weaknesses—`Assets as Device has is_licensed = false and last_observed_at > "1988-01-01"`
                         * @example Assets
                         */
                        text: string;
                    };
                } | null;
            };
        };
        responses: {
            /** @description Returned if the asset export request was successfully queued. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description The unique identifier (UUID) of the asset export.
                         */
                        export_id?: string;
                    };
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to export assets. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
        };
    };
    "inventory-export-findings": {
        parameters: {
            query?: {
                /**
                 * @description Specifies which findings properties to include in the export. Provide multiple properties as a comma-separated list.
                 *
                 *     By default, if no properties are provided, the export includes the following properties: `asset_id`, `finding_id`, `finding_name`, `severity`, and `state`
                 *
                 *     Use the [List findings properties](ref:inventory-finding-properties-list) endpoint to retrieve a list of valid properties for this parameter. For example, you might include `asset_name`, `solution`, and `vpr_score` as properties.
                 */
                properties?: string;
                /** @description When set to `true`, returns the human-readable names of properties instead of internal key names. */
                use_readable_name?: boolean;
                /**
                 * @description Maximum size, in bytes, for each export chunk when exporting large datasets.
                 *
                 *     If omitted, the default is `20971520` bytes (20 MB). The maximum value is `104857600` (100 MB) and the minimum value is `5242880` (5 MB).
                 */
                max_chunk_file_size?: number;
                /**
                 * @description The property and direction to sort the results by, in the format `property:direction`. For example: `finding_name:asc` or `severity:desc`
                 * @example severity:desc
                 */
                sort?: string;
                /**
                 * @description Specifies the file format for the export.
                 *
                 *     Defaults to `JSON` if not provided. Valid values are `CSV` and `JSON`.
                 * @example JSON
                 */
                file_format?: components["schemas"]["Inventory_Exports_Dataset-File-Format"];
                /**
                 * @description When set to `true`, the exported file is compressed using GZIP.
                 *
                 *     The compressed file retains its original format (CSV or JSON) but is smaller in size, which helps reduce download time and storage requirements. You must decompress the file with a standard GZIP tool before processing. This option is particularly useful for large exports or limited-bandwidth environments.
                 * @example true
                 */
                compress?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /**
                     * @description A set of asset properties used to filter the export results.
                     *
                     *     Use the [List finding properties](ref:inventory-finding-properties-list) endpoint to view available finding properties that can be used as filters.
                     */
                    filters?: components["schemas"]["Inventory_Exports_Findings-Property-Filter"][] | null;
                    /** @description Filter the export results by query. A query consists of the search mode and query text. */
                    query?: {
                        /**
                         * @description The mode to use for the query. You can choose either `simple` or `advanced`.
                         *     * `simple`—A simple query enables you to search for findings by finding name or finding ID.
                         *     * `advanced`—An advanced query enables you to build a specific query to search for findings.
                         * @default simple
                         * @enum {string}
                         */
                        mode: "simple" | "advanced";
                        /**
                         * @description For simple searches, either a finding name or a finding ID. For advanced searches, a query string. Advanced users can use the query builder in the user interface to create a query string.
                         *
                         *     For example, some common advanced queries are:
                         *
                         *     * Findings with a CVSSv3 base score equal to 10—`Findings HAS finding_cvss3_base_score = 10`
                         *     * Findings last seen after a particular date—`Findings HAS last_observed_at > "2025-11-12"`
                         * @example Findings
                         */
                        text: string;
                    };
                } | null;
            };
        };
        responses: {
            /** @description Returned if the findings export request was successfully queued. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @description The unique identifier (UUID) of the findings export.
                         */
                        export_id?: string;
                    };
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to export findings. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
        };
    };
    "inventory-export-assets-jobs": {
        parameters: {
            query?: {
                /**
                 * @description Filters the results by export job status.
                 *
                 *     Supported values include:
                 *
                 *      * `QUEUED`—The request is waiting for earlier requests to complete.
                 *      * `PROCESSING`—The request is currently being processed.
                 *      * `FINISHED`—Processing is complete, and all chunks are available.
                 *      * `ERROR`—An error occurred while processing. Retry the request, and if the issue persists, contact Tenable Support.
                 */
                status?: components["parameters"]["Inventory_Exports_status-query-param"];
                /**
                 * @description The maximum number of export jobs to return from the last 3 days.
                 *
                 *     **Note:** Only jobs submitted within the last 3 days are returned. The actual number of results may be less than the specified limit if fewer jobs exist.
                 *
                 *     If omitted, the default is `1000`. The maximum value is `1000` and the minimum value is `1`.
                 * @example 100
                 */
                limit?: components["parameters"]["Inventory_Exports_limit-query-param"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the list of asset export jobs was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        exports?: components["schemas"]["Inventory_Exports_Response-Export-Job"][];
                    };
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponseStatus-400"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view asset export jobs. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
        };
    };
    "inventory-export-findings-jobs": {
        parameters: {
            query?: {
                /**
                 * @description Filters the results by export job status.
                 *
                 *     Supported values include:
                 *
                 *      * `QUEUED`—The request is waiting for earlier requests to complete.
                 *      * `PROCESSING`—The request is currently being processed.
                 *      * `FINISHED`—Processing is complete, and all chunks are available.
                 *      * `ERROR`—An error occurred while processing. Retry the request, and if the issue persists, contact Tenable Support.
                 */
                status?: components["parameters"]["Inventory_Exports_status-query-param"];
                /**
                 * @description The maximum number of export jobs to return from the last 3 days.
                 *
                 *     **Note:** Only jobs submitted within the last 3 days are returned. The actual number of results may be less than the specified limit if fewer jobs exist.
                 *
                 *     If omitted, the default is `1000`. The maximum value is `1000` and the minimum value is `1`.
                 * @example 100
                 */
                limit?: components["parameters"]["Inventory_Exports_limit-query-param"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the list of findings export jobs was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        exports?: components["schemas"]["Inventory_Exports_Response-Export-Job"][];
                    };
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponseStatus-400"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view findings export jobs. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
        };
    };
    "inventory-export-status": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The unique identifier (UUID) of the export request whose status you want to retrieve. */
                export_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the status of the specified export request was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_Response-Export-Status"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view the export status. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if the specified export request was not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
        };
    };
    "inventory-export-download": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The unique identifier (UUID) of the export request for which you want to download a chunk. */
                export_id: string;
                /**
                 * @description The specific chunk number to retrieve from the export request.
                 *
                 *     **Note:** For exports in CSV format, each chunk includes a header row.
                 */
                chunk_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the assets export chunk was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": components["schemas"]["Inventory_Exports_Response-Assets-Chunk-JSON"][] | string | components["schemas"]["Inventory_Exports_Response-Findings-Chunk-JSON"][];
                };
            };
            /** @description Returned if the export request chunk is not yet ready for download. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to download exports. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if the specified export request or chunk was not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponseStatus"];
                };
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Exports_ErrorResponse"];
                };
            };
        };
    };
    "inventory-tag-search": {
        parameters: {
            query?: {
                /**
                 * @description Specifies extra tag properties to include in the search results. You can provide multiple properties as a comma-separated list.
                 *
                 *     Use the [List tag properties](ref:inventory-tag-properties-list) endpoint to retrieve a list of valid properties for this parameter. For example, you might include `tag_data_source`, `last_updated`, and `tag_created_by_id` as extra properties.
                 */
                extra_properties?: string;
                /** @description The starting record to retrieve. If omitted, the default value is `0`. */
                offset?: number;
                /** @description The number of records to retrieve. If omitted, the default value is `1000`. The maximum value is `1000`. */
                limit?: number;
                /**
                 * @description The property and direction to sort the results by, in the format `property:direction`. For example: `tag_name:asc` or `last_updated:desc`
                 * @example tag_name:asc
                 */
                sort?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Inventory_Request-Search-Tags"];
            };
        };
        responses: {
            /** @description Returned if the list of assets was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_Response-Search-Tags"];
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to search tags. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
        };
    };
    "inventory-tag-properties-list": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Returned if the list of tag properties was retrieved successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data?: components["schemas"]["Inventory_Properties-Object"][];
                    };
                };
            };
            /** @description Returned if your request specified invalid parameters or if your request was improperly formatted. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if the API keys specified in your request are invalid. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
            /** @description Returned if you do not have permission to view the list of tag properties. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Returned if you attempt to send too many requests in a specific period of time. For more information, see [Rate Limiting](doc:rate-limiting). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": unknown;
                };
            };
            /** @description Returned if an internal error occurred. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Inventory_ErrorResponse"];
                };
            };
        };
    };
}
