#!/bin/bash

# Script to delete the branch copilot/fix-144e10d6-34c0-49f8-ad7d-e29e29a791be
# Usage: ./scripts/delete-branch.sh

set -e

BRANCH_NAME="copilot/fix-144e10d6-34c0-49f8-ad7d-e29e29a791be"
PR_NUMBER=1

echo "🗑️  Branch Deletion Script"
echo "=========================="
echo ""
echo "Branch to delete: $BRANCH_NAME"
echo "Associated PR: #$PR_NUMBER"
echo ""

# Check if gh CLI is available
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI (gh) is available"
    
    read -p "Do you want to close PR #$PR_NUMBER? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Closing PR #$PR_NUMBER..."
        gh pr close $PR_NUMBER
        echo "✅ PR closed"
    fi
    
    echo ""
    read -p "Do you want to delete the branch $BRANCH_NAME? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting branch $BRANCH_NAME..."
        gh api -X DELETE "/repos/iammultiman/baseline-analyzer/git/refs/heads/$BRANCH_NAME"
        echo "✅ Branch deleted"
    fi
else
    echo "⚠️  GitHub CLI (gh) not found. Using git commands..."
    echo ""
    
    read -p "Do you want to delete the remote branch $BRANCH_NAME? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting remote branch $BRANCH_NAME..."
        git push origin --delete "$BRANCH_NAME"
        echo "✅ Remote branch deleted"
        
        # Check if local branch exists
        if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
            echo "Local branch exists, deleting..."
            git branch -D "$BRANCH_NAME"
            echo "✅ Local branch deleted"
        fi
    fi
    
    echo ""
    echo "⚠️  Note: You will need to manually close PR #$PR_NUMBER on GitHub"
    echo "    Visit: https://github.com/iammultiman/baseline-analyzer/pull/$PR_NUMBER"
fi

echo ""
echo "✨ Cleanup complete!"
