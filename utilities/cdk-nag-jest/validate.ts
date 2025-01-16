/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { Stack } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { CdkNagError } from './error';

/**
 * Validates that there are no CDK Nag Findings for a given stack. This function
 * performs the validation by checking for the presence of any warnings or errors
 * in the CDK Nag annotations.
 *
 * If constructName is provided, this function will filter out specific CDK Nag findings not
 * related to the `constructName`. If constructName is not provided, it will check the entire stack.
 * It will also filter out any backend generated constructs that are generated by CDK itself.
 *
 * Finally, it will throw an error that will return back to the Jest framework
 * to make it easily discoverable and readable.
 *
 * @param stack the stack to validate against.
 * @param constructName optional - the construct name to check for. If not provided, checks entire stack.
 */
export function validateNoCdkNagFindings(stack: Stack, constructName?: string) {
    const allIssues: { type: string; pattern: string; annotations: any[] }[] =
        [];

    const checkAnnotations = (type: 'warning' | 'error', pattern: string) => {
        const method = type === 'warning' ? 'findWarning' : 'findError';
        const allAnnotations = Annotations.fromStack(stack)[method](
            '*',
            Match.stringLikeRegexp(pattern)
        );

        // Filter annotations to remove "framework-OnEvent" constructs
        // If constructName is provided, also filter to only include annotations with that constructName
        const annotations = allAnnotations.filter((a) => {
            const excludeFrameworkOnEvent = !a.id.includes('framework-onEvent');
            if (constructName) {
                return excludeFrameworkOnEvent && a.id.includes(constructName);
            }
            return excludeFrameworkOnEvent;
        });

        if (annotations.length > 0) {
            allIssues.push({ type, pattern, annotations });
        }
    };

    checkAnnotations('warning', 'NIST.*');
    checkAnnotations('warning', 'AwsSolutions-.*');
    checkAnnotations('error', 'NIST.*');
    checkAnnotations('error', 'AwsSolutions-.*');

    if (allIssues.length > 0) {
        const message = allIssues
            .map((issue) => {
                const issueMessage = `Found ${issue.annotations.length} ${issue.pattern} ${issue.type}(s):\n`;
                const details = issue.annotations
                    .map((a) => `${a.id}\n${a.entry.data}`)
                    .join('\n');
                return `${issueMessage}\n${details}`;
            })
            .join('\n\n');

        const allAnnotations = allIssues.flatMap((issue) => issue.annotations);
        throw new CdkNagError(message, allAnnotations);
    }
}
