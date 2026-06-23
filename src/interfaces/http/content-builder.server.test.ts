import { describe, expect, it } from "vitest";
import {
  TransformTypeNameAlreadyExistsError,
  TransformTypeNotFoundError,
} from "../../content-builder/application";
import { createHttpServer } from "./server";
import {
  createUnusedCollectorProfileManagerHttpService,
} from "./test-support/collector-profile-manager-http-service";
import {
  createUnusedCollectorRuntimeHttpService,
} from "./test-support/collector-runtime-http-service";
import {
  createFakeContentBuilderHttpService,
  createTransformType,
} from "./test-support/content-builder-http-service";
import {
  createFakeContentManagerHttpService,
} from "./test-support/content-manager-http-service";
import { FakeSourceGroupReferencePort } from "./test-support/source-group-reference-port";

describe("Content Builder HTTP routes", () => {
  it("creates transform types through a safe DTO", async () => {
    const { server, service } = createTestServer();
    service.createTransformType.setOutput(
      createTransformType({ description: undefined }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/builder/transform-types",
        payload: {
          name: " Hook Rewrite ",
          description: "Creates a hook.",
          initialPrompt: " Rewrite this into a hook. ",
        },
      });
      const body = response.json();

      expect(response.statusCode).toBe(201);
      expect(service.createTransformType.calls).toEqual([
        {
          name: "Hook Rewrite",
          description: "Creates a hook.",
          initialPrompt: "Rewrite this into a hook.",
        },
      ]);
      expect(body).toMatchObject({
        transformType: {
          transformTypeId: "transform-type-1",
          name: "Hook Rewrite",
          initialPrompt:
            "Rewrite the collected content into a short video hook.",
          status: "ACTIVE",
        },
      });
      expect(body.transformType).not.toHaveProperty("description");
      expectSafeTransformTypePayload(body);
    } finally {
      await server.close();
    }
  });

  it("rejects unknown create fields and blank required strings", async () => {
    const { server, service } = createTestServer();

    try {
      const unknownResponse = await server.inject({
        method: "POST",
        url: "/builder/transform-types",
        payload: {
          name: "Hook",
          initialPrompt: "Prompt",
          providerKey: "not-allowed",
        },
      });
      const blankResponse = await server.inject({
        method: "POST",
        url: "/builder/transform-types",
        payload: {
          name: " ",
          initialPrompt: "Prompt",
        },
      });
      const blankPromptResponse = await server.inject({
        method: "POST",
        url: "/builder/transform-types",
        payload: {
          name: "Hook",
          initialPrompt: "   ",
        },
      });

      expect(unknownResponse.statusCode).toBe(400);
      expect(blankResponse.statusCode).toBe(400);
      expect(blankPromptResponse.statusCode).toBe(400);
      expect(service.createTransformType.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("accepts blank optional descriptions on create and omits the field", async () => {
    const { server, service } = createTestServer();
    service.createTransformType.setOutput(
      createTransformType({ description: undefined }),
    );

    try {
      const emptyResponse = await server.inject({
        method: "POST",
        url: "/builder/transform-types",
        payload: {
          name: "Hook Rewrite",
          description: "",
          initialPrompt: "Rewrite this into a hook.",
        },
      });
      const whitespaceResponse = await server.inject({
        method: "POST",
        url: "/builder/transform-types",
        payload: {
          name: "Hook Rewrite",
          description: "   ",
          initialPrompt: "Rewrite this into a hook.",
        },
      });

      expect(emptyResponse.statusCode).toBe(201);
      expect(whitespaceResponse.statusCode).toBe(201);
      expect(service.createTransformType.calls).toEqual([
        {
          name: "Hook Rewrite",
          initialPrompt: "Rewrite this into a hook.",
        },
        {
          name: "Hook Rewrite",
          initialPrompt: "Rewrite this into a hook.",
        },
      ]);
      expect(emptyResponse.json().transformType).not.toHaveProperty(
        "description",
      );
      expect(whitespaceResponse.json().transformType).not.toHaveProperty(
        "description",
      );
    } finally {
      await server.close();
    }
  });

  it("maps duplicate active names to 409", async () => {
    const { server, service } = createTestServer();
    service.createTransformType.setError(
      new TransformTypeNameAlreadyExistsError("hook rewrite"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/builder/transform-types",
        payload: {
          name: "Hook Rewrite",
          initialPrompt: "Prompt",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: { code: "TRANSFORM_TYPE_NAME_ALREADY_EXISTS" },
      });
    } finally {
      await server.close();
    }
  });

  it("lists transform types with status filters and pagination", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/builder/transform-types?status=ACTIVE&limit=10&offset=5",
      });

      expect(response.statusCode).toBe(200);
      expect(service.listTransformTypes.calls).toEqual([
        {
          status: "ACTIVE",
          limit: 10,
          offset: 5,
        },
      ]);
      expect(response.json()).toMatchObject({
        items: [
          {
            transformTypeId: "transform-type-1",
            status: "ACTIVE",
          },
        ],
        page: {
          limit: 50,
          offset: 0,
          total: 1,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("gets, updates, and archives transform types", async () => {
    const { server, service } = createTestServer();
    service.updateTransformType.setOutput(
      createTransformType({
        name: "Updated",
        description: undefined,
        initialPrompt: "Updated prompt.",
      }),
    );

    try {
      const getResponse = await server.inject({
        method: "GET",
        url: "/builder/transform-types/transform-type-1",
      });
      const updateResponse = await server.inject({
        method: "PATCH",
        url: "/builder/transform-types/transform-type-1",
        payload: {
          name: " Updated ",
          description: null,
          initialPrompt: " Updated prompt. ",
        },
      });
      const archiveResponse = await server.inject({
        method: "POST",
        url: "/builder/transform-types/transform-type-1/archive",
      });

      expect(getResponse.statusCode).toBe(200);
      expect(service.getTransformType.calls).toEqual([
        { transformTypeId: "transform-type-1" },
      ]);
      expect(updateResponse.statusCode).toBe(200);
      expect(service.updateTransformType.calls).toEqual([
        {
          transformTypeId: "transform-type-1",
          name: "Updated",
          clearDescription: true,
          initialPrompt: "Updated prompt.",
        },
      ]);
      expect(updateResponse.json().transformType).not.toHaveProperty(
        "description",
      );
      expect(archiveResponse.statusCode).toBe(200);
      expect(service.archiveTransformType.calls).toEqual([
        { transformTypeId: "transform-type-1" },
      ]);
      expect(archiveResponse.json()).toMatchObject({
        transformType: { status: "ARCHIVED" },
      });
    } finally {
      await server.close();
    }
  });

  it("maps missing transform types to 404", async () => {
    const { server, service } = createTestServer();
    service.getTransformType.setError(
      new TransformTypeNotFoundError("missing"),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/builder/transform-types/missing",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: "TRANSFORM_TYPE_NOT_FOUND" },
      });
    } finally {
      await server.close();
    }
  });

  it("treats blank optional descriptions on update as omitted and clears stored description", async () => {
    const { server, service } = createTestServer();
    service.updateTransformType.setOutput(
      createTransformType({ description: undefined }),
    );

    try {
      const emptyResponse = await server.inject({
        method: "PATCH",
        url: "/builder/transform-types/transform-type-1",
        payload: {
          description: "",
        },
      });
      const whitespaceResponse = await server.inject({
        method: "PATCH",
        url: "/builder/transform-types/transform-type-1",
        payload: {
          description: "   ",
        },
      });
      const nullResponse = await server.inject({
        method: "PATCH",
        url: "/builder/transform-types/transform-type-1",
        payload: {
          description: null,
        },
      });

      expect(emptyResponse.statusCode).toBe(200);
      expect(whitespaceResponse.statusCode).toBe(200);
      expect(nullResponse.statusCode).toBe(200);
      expect(service.updateTransformType.calls).toEqual([
        {
          transformTypeId: "transform-type-1",
          clearDescription: true,
        },
        {
          transformTypeId: "transform-type-1",
          clearDescription: true,
        },
        {
          transformTypeId: "transform-type-1",
          clearDescription: true,
        },
      ]);
      expect(emptyResponse.json().transformType).not.toHaveProperty(
        "description",
      );
      expect(whitespaceResponse.json().transformType).not.toHaveProperty(
        "description",
      );
      expect(nullResponse.json().transformType).not.toHaveProperty(
        "description",
      );
    } finally {
      await server.close();
    }
  });
});

function createTestServer(): {
  readonly server: ReturnType<typeof createHttpServer>;
  readonly service: ReturnType<typeof createFakeContentBuilderHttpService>;
} {
  const service = createFakeContentBuilderHttpService();

  return {
    server: createHttpServer({
      collectorProfileManager: createUnusedCollectorProfileManagerHttpService(),
      sourceGroupReferences: new FakeSourceGroupReferencePort(),
      collectorRuntime: createUnusedCollectorRuntimeHttpService(),
      contentManager: createFakeContentManagerHttpService(),
      contentBuilder: service,
    }),
    service,
  };
}

function expectSafeTransformTypePayload(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("cookie");
  expect(serialized).not.toContain("localStorage");
  expect(serialized).not.toContain("authorization");
  expect(serialized).not.toContain("proxy");
  expect(serialized).not.toContain("fingerprint");
  expect(serialized).not.toContain("rawFacebook");
  expect(serialized).not.toContain("runtime");
  expect(serialized).not.toContain("providerKey");
}
