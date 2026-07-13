/**
 * Sanitized real-shape home-feed group text post.
 *
 * Topology only: preserves the Sprint 075A diagnosed failure where an eligible
 * configured-group Story is recognized as GROUP via comet_sections.action_link.group
 * but lacks a stable group_id-style publisher id, so extraction yields zero candidates.
 */
export const sanitizedRealshapeHomeFeedGroupTextPostPayload = {
  data: {
    node: {
      __typename: "Story",
      post_id: "fixture-realshape-group-post-1",
      permalink_url:
        "https://www.facebook.com/groups/synthetic-home-feed-group/posts/fixture-realshape-group-post-1/",
      actors: [
        {
          __typename: "User",
          id: "fixture-member-author-1",
          name: "Synthetic Group Member",
        },
      ],
      to: {
        __typename: "Group",
        id: "fixture-group-graphql-node-id",
        name: "Synthetic Home Feed Group",
        url: "https://www.facebook.com/groups/synthetic-home-feed-group/",
      },
      comet_sections: {
        __typename: "CometStorySections",
        content: {
          __typename: "CometFeedStoryDefaultContentStrategy",
          story: {
            post_id: "fixture-realshape-group-post-1",
            message: {
              __typename: "TextWithEntities",
              text: "Synthetic eligible configured-group text post body for home-feed calibration.",
            },
            actors: [
              {
                __typename: "User",
                id: "fixture-member-author-1",
                name: "Synthetic Group Member",
              },
            ],
            target_group: {
              id: "fixture-group-graphql-node-id",
            },
            wwwURL:
              "https://www.facebook.com/groups/synthetic-home-feed-group/posts/fixture-realshape-group-post-1/",
          },
        },
        action_link: {
          __typename: "GroupMemberProfileActionLink",
          group: {
            __typename: "Group",
            id: "fixture-group-graphql-node-id",
          },
        },
      },
    },
  },
} as const;
