import { inject, injectable, } from 'inversify';
import { ServiceIdentifiers } from '../../container/ServiceIdentifiers';

import * as ESTree from 'estree';

import { IOptions } from '../../interfaces/options/IOptions';
import { IRandomGenerator } from '../../interfaces/utils/IRandomGenerator';
import { IVisitor } from '../../interfaces/node-transformers/IVisitor';

import { TransformationStage } from '../../enums/node-transformers/TransformationStage';

import { AbstractNodeTransformer } from '../AbstractNodeTransformer';
import { NodeFactory } from '../../node/NodeFactory';
import { NodeGuards } from '../../node/NodeGuards';

/**
 * Transform ES2015 template literals to ES5
 * Thanks to Babel for algorithm
 */
@injectable()
export class TemplateLiteralTransformer extends AbstractNodeTransformer {
    /**
     * @param {IRandomGenerator} randomGenerator
     * @param {IOptions} options
     */
    constructor (
        @inject(ServiceIdentifiers.IRandomGenerator) randomGenerator: IRandomGenerator,
        @inject(ServiceIdentifiers.IOptions) options: IOptions
    ) {
        super(randomGenerator, options);
    }

    /**
     * @param {NodeGuards} node
     * @returns {boolean}
     */
    private static isLiteralNodeWithStringValue (node: ESTree.Node): boolean {
        return node && NodeGuards.isLiteralNode(node) && typeof node.value === 'string';
    }

    /**
     * @param {TransformationStage} transformationStage
     * @returns {IVisitor | null}
     */
    public getVisitor (transformationStage: TransformationStage): IVisitor | null {
        switch (transformationStage) {
            case TransformationStage.Converting:
                return {
                    leave: (node: ESTree.Node, parentNode: ESTree.Node | null) => {
                        if (parentNode && NodeGuards.isTemplateLiteralNode(node)) {
                            return this.transformNode(node, parentNode);
                        }
                    }
                };

            default:
                return null;
        }
    }

    /**
     * @param {TemplateLiteral} templateLiteralNode
     * @param {NodeGuards} parentNode
     * @returns {NodeGuards}
     */
    public transformNode (templateLiteralNode: ESTree.TemplateLiteral, parentNode: ESTree.Node): ESTree.Node {
        const templateLiteralExpressions: ESTree.Expression[] = templateLiteralNode.expressions;

        let nodes: ESTree.Expression[] = [];

        templateLiteralNode.quasis.forEach((templateElement: ESTree.TemplateElement) => {
            nodes.push(NodeFactory.literalNode(templateElement.value.cooked));

            const expression: ESTree.Expression | undefined = templateLiteralExpressions.shift();

            if (!expression) {
                return;
            }

            nodes.push(expression);
        });

        nodes = nodes.filter((node: ESTree.Literal | ESTree.Expression) => {
            return !(NodeGuards.isLiteralNode(node) && node.value === '');
        });

        // since `+` is left-to-right associative
        // ensure the first node is a string if first/second isn't
        if (
            !TemplateLiteralTransformer.isLiteralNodeWithStringValue(nodes[0]) &&
            !TemplateLiteralTransformer.isLiteralNodeWithStringValue(nodes[1])
        ) {
            nodes.unshift(NodeFactory.literalNode(''));
        }

        if (nodes.length > 1) {
            let root: ESTree.BinaryExpression = NodeFactory.binaryExpressionNode(
                '+',
                <ESTree.Literal>nodes.shift(),
                <ESTree.Expression>nodes.shift()
            );

            nodes.forEach((node: ESTree.Literal | ESTree.Expression) => {
                root = NodeFactory.binaryExpressionNode('+', root, node);
            });

            return root;
        }

        return nodes[0];
    }
}
