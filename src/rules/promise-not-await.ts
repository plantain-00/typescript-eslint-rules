import { TSESTree } from '@typescript-eslint/experimental-utils'
import ts from 'typescript'

import { createRule, getParserServices } from '../utils'

type MessageIds = 'promiseNotAwait'

function findParentFunction(node: ts.Node): ts.Node | undefined {
  const parent = node.parent
  if (ts.isFunctionDeclaration(parent)
    || ts.isFunctionExpression(parent)
    || ts.isArrowFunction(parent)
    || ts.isMethodDeclaration(parent)) {
    return parent
  }
  if (ts.isSourceFile(parent)) {
    return undefined
  }
  return findParentFunction(parent)
}

function findFunction(node: ts.Node) {
  // tslint:disable-next-line:max-union-size
  return findParentFunction(node) as ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration | undefined
}

export default createRule<[], MessageIds>({
  name: 'promise-not-await',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Requires any statement that returns a Promise to be await',
      category: 'Best Practices',
      recommended: false
    },
    messages: {
      promiseNotAwait: 'Statements that return promises must be await.'
    },
    schema: []
  },
  defaultOptions: [],
  create(context) {
    const parserServices = getParserServices(context)
    const checker = parserServices.program.getTypeChecker()

    function checkTypeIsPromise(
      node: ts.IfStatement | ts.WhileStatement | ts.CallExpression,
      type: ts.Type
    ) {
      if (type.symbol && type.symbol.escapedName === 'Promise') {
        context.report({
          messageId: 'promiseNotAwait',
          node: parserServices.tsNodeToESTreeNodeMap.get(node)
        })
      }
    }

    function checkCallExpressionReturnPromise(node: ts.CallExpression) {
      const signature = checker.getResolvedSignature(node)
      if (signature) {
        const returnType = checker.getReturnTypeOfSignature(signature)
        checkTypeIsPromise(node, returnType)
      }
    }

    return {
      'CallExpression'(node: TSESTree.CallExpression) {
        const originalNode = parserServices.esTreeNodeToTSNodeMap.get(node)
        if (ts.isReturnStatement(originalNode.parent) || ts.isAwaitExpression(originalNode.parent)) {
          return
        }

        const functionNode = findFunction(originalNode)
        if (!functionNode) {
          return
        }

        checkCallExpressionReturnPromise(originalNode as ts.CallExpression)
      }
    }
  }
})
