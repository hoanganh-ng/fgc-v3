const groupPublisher = {
  kind: "GROUP",
  group_id: "stable-group-123",
  name: "Synthetic Home Feed Group",
  canonicalUrl: "https://www.facebook.com/groups/synthetic-home-feed-group/",
} as const;

const pagePublisher = {
  kind: "PAGE",
  page_id: "stable-page-456",
  name: "Synthetic Home Feed Page",
  canonicalUrl: "https://www.facebook.com/synthetic-home-feed-page/",
} as const;

export const syntheticHomeFeedGroupPostByIndividualPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "home-group-post-1",
            url: "https://www.facebook.com/groups/synthetic-home-feed-group/posts/home-group-post-1/",
            sourcePublisher: groupPublisher,
            message: {
              __typename: "TextWithEntities",
              text: "A home-feed group post written by an individual member.",
            },
            actors: [
              {
                __typename: "User",
                id: "member-author-123",
                name: "Synthetic Group Member",
              },
            ],
            creation_time: "2026-04-01T09:15:00.000Z",
            feedback: {
              reaction_count: {
                count: 14,
              },
              comment_count: {
                total_count: 2,
              },
              share_count: {
                count: 1,
              },
              display_comments: {
                edges: [
                  {
                    node: {
                      __typename: "Comment",
                      comment_id: "home-group-comment-1",
                      body: {
                        text: "Good reminder for the group workflow.",
                      },
                      author: {
                        id: "commenter-1",
                        name: "Synthetic Commenter",
                      },
                      feedback: {
                        reaction_count: {
                          count: 6,
                        },
                      },
                      reply_count: 1,
                      created_time: "2026-04-01T09:20:00.000Z",
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedPagePostPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            story_fbid: "home-page-post-1",
            permalink_url:
              "https://www.facebook.com/synthetic-home-feed-page/posts/home-page-post-1/",
            sourcePublisher: pagePublisher,
            title: {
              text: "Page update",
            },
            message: {
              fragments: [
                {
                  text: "A page post discovered from the home feed",
                },
                {
                  text: "with normalized body text.",
                },
              ],
            },
            from: {
              __typename: "Page",
              page_id: "stable-page-456",
              name: "Synthetic Home Feed Page",
            },
            timestamp: 1775037600,
            feedback: {
              reaction_count: 30,
              comment_count: 1,
              share_count: 4,
            },
            comments: {
              nodes: [
                {
                  __typename: "Comment",
                  id: "home-page-comment-1",
                  bodyText: "Useful page update.",
                  author: {
                    id: "page-commenter-1",
                    name: "Synthetic Page Commenter",
                  },
                  reaction_count: 3,
                  reply_count: 0,
                  created_time: 1775037900,
                },
              ],
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedSponsoredGroupPostPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "GroupPostStory",
            post_id: "sponsored-group-post",
            url: "https://www.facebook.com/groups/synthetic-home-feed-group/posts/sponsored-group-post/",
            sourcePublisher: groupPublisher,
            message: {
              text: "This post has explicit ad metadata and must be excluded.",
            },
            sponsoredData: {
              ad_id: "synthetic-ad-001",
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedSponsoredPagePostPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "sponsored-page-post",
            url: "https://www.facebook.com/synthetic-home-feed-page/posts/sponsored-page-post/",
            sourcePublisher: pagePublisher,
            message: {
              text: "This page post has an explicit sponsored marker.",
            },
            isSponsored: true,
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedPersonalProfilePostPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "personal-profile-post",
            url: "https://www.facebook.com/synthetic-person/posts/personal-profile-post/",
            sourcePublisher: {
              kind: "PROFILE",
              profile_id: "personal-profile-123",
              name: "Synthetic Personal Profile",
            },
            message: {
              text: "A personal profile post should not be collected.",
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedUnknownPublisherKindPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "unknown-publisher-kind-post",
            url: "https://www.facebook.com/events/synthetic-event/posts/unknown-publisher-kind-post/",
            sourcePublisher: {
              kind: "EVENT",
              event_id: "event-123",
              name: "Synthetic Event",
            },
            message: {
              text: "An unsupported publisher kind should be skipped.",
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedMissingStablePublisherIdPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "missing-stable-publisher-id-post",
            url: "https://www.facebook.com/groups/mutable-slug/posts/missing-stable-publisher-id-post/",
            sourcePublisher: {
              kind: "GROUP",
              id: "arbitrary-graphql-node-id",
              name: "Synthetic Mutable Slug Group",
              canonicalUrl: "https://www.facebook.com/groups/mutable-slug/",
            },
            message: {
              text: "A display name, GraphQL id, and URL slug are not stable identity.",
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedDuplicatePostsPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "duplicate-home-feed-post",
            url: "https://www.facebook.com/groups/synthetic-home-feed-group/posts/duplicate-home-feed-post/",
            sourcePublisher: groupPublisher,
            message: {
              text: "Short duplicate home-feed body.",
            },
            feedback: {
              reaction_count: {
                count: 1,
              },
              comment_count: {
                count: 0,
              },
            },
          },
        },
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "duplicate-home-feed-post",
            url: "https://www.facebook.com/groups/synthetic-home-feed-group/posts/duplicate-home-feed-post/",
            sourcePublisher: groupPublisher,
            message: {
              text: "Richer duplicate home-feed body with comments.",
            },
            actors: [
              {
                id: "duplicate-home-author",
                name: "Synthetic Duplicate Home Author",
              },
            ],
            creation_time: "2026-04-02T11:00:00.000Z",
            feedback: {
              reaction_count: {
                count: 22,
              },
              comment_count: {
                count: 1,
              },
            },
            comments: {
              nodes: [
                {
                  __typename: "Comment",
                  comment_id: "duplicate-home-comment",
                  body: {
                    text: "The richer duplicate keeps this comment.",
                  },
                  feedback: {
                    reaction_count: {
                      count: 5,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedSponsoredWordOnlyPayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "body-contains-sponsored-word",
            url: "https://www.facebook.com/groups/synthetic-home-feed-group/posts/body-contains-sponsored-word/",
            sourcePublisher: groupPublisher,
            message: {
              text: "The word sponsored appears in this normal group discussion.",
            },
            actors: [
              {
                __typename: "User",
                id: "member-author-456",
                name: "Synthetic Discussion Member",
              },
            ],
            feedback: {
              reaction_count: {
                count: 2,
              },
              comment_count: {
                count: 0,
              },
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedUnrelatedNestedProfilePayload = {
  data: {
    home_feed: {
      edges: [
        {
          node: {
            __typename: "CometFeedStory",
            post_id: "group-post-with-unrelated-profile-data",
            url: "https://www.facebook.com/groups/synthetic-home-feed-group/posts/group-post-with-unrelated-profile-data/",
            sourcePublisher: groupPublisher,
            message: {
              text: "A valid group post with unrelated nested profile data.",
            },
            actors: [
              {
                __typename: "User",
                id: "member-author-789",
                name: "Synthetic Nested Profile Author",
              },
            ],
            attachments: [
              {
                relatedProfile: {
                  __typename: "User",
                  id: "unrelated-profile-id",
                  name: "Synthetic Related Profile",
                },
              },
            ],
            feedback: {
              reaction_count: {
                count: 7,
              },
              comment_count: {
                count: 0,
              },
            },
          },
        },
      ],
    },
  },
} as const;

export const syntheticHomeFeedFixtures = [
  syntheticHomeFeedGroupPostByIndividualPayload,
  syntheticHomeFeedPagePostPayload,
  syntheticHomeFeedSponsoredGroupPostPayload,
  syntheticHomeFeedSponsoredPagePostPayload,
  syntheticHomeFeedPersonalProfilePostPayload,
  syntheticHomeFeedUnknownPublisherKindPayload,
  syntheticHomeFeedMissingStablePublisherIdPayload,
  syntheticHomeFeedDuplicatePostsPayload,
  syntheticHomeFeedSponsoredWordOnlyPayload,
  syntheticHomeFeedUnrelatedNestedProfilePayload,
] as const;
