const commentReactions = [5, 15, 15, 3, 8, 13, 2, 11, 7, 6, 10, 9] as const;

export const syntheticCommentsAndCountsPayload = {
  data: {
    nested: {
      story: {
        __typename: "GroupPostStory",
        post_id: "post-with-comments",
        message: {
          fragments: [
            {
              text: "A longer group post with enough comments",
            },
            {
              text: "to verify top comment selection.",
            },
          ],
        },
        feedback: {
          reaction_count: {
            count: "128",
          },
          comment_count: {
            total_count: 14,
          },
        },
        comments: {
          edges: [
            ...commentReactions.map((reactionCount, index) => ({
              node: {
                __typename: "Comment",
                comment_id: `comment-${String(index + 1).padStart(2, "0")}`,
                body: {
                  text: `Synthetic comment ${index + 1}`,
                },
                author: {
                  id: `comment-author-${index + 1}`,
                  name: `Synthetic Commenter ${index + 1}`,
                },
                feedback: {
                  reaction_count: {
                    count: reactionCount,
                  },
                },
                reply_count: index % 3,
              },
            })),
            {
              node: {
                __typename: "Comment",
                body: {
                  text: "This comment has no id and should be skipped.",
                },
                feedback: {
                  reaction_count: {
                    count: 99,
                  },
                },
              },
            },
            {
              node: {
                __typename: "Comment",
                comment_id: "comment-without-body",
                feedback: {
                  reaction_count: {
                    count: 98,
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
} as const;
