import { assertEquals, assert } from "jsr:@std/assert@1";

import { filter, Router, StatusCode } from "@trie/http-router";

const delay = (timeout: number) =>
  new Promise((resolve) => setTimeout(resolve, timeout));

const info: Deno.ServeHandlerInfo<Deno.NetAddr> = {
  completed: new Promise<void>((resolve) => resolve()),
  remoteAddr: {
    hostname: "127.0.0.1",
    port: 51239,
    transport: "tcp",
  },
};

const router = new Router();

router.handle("GET /defined")((pr) => pr.end(StatusCode.OK));
router.handle("Get /case-SENSITIVe")((pr) => pr.end(StatusCode.OK));
router.handle("GET /unimplemented")(() => {});
router.handle("GET /|home|about:page")((pr) =>
  pr.text(pr.params.page || "home")
);

router.filter("* /limited/resource-b")([
  filter.accessControl({
    allowOrigins: ["http://localhost:3000"],
    allowCredentials: true,
    allowHeaders: ["content-type", "content-length", "authorization"],
    allowMethods: ["GET", "POST"],
  }),
  filter.rateLimit({
    maxTokens: 3,
    refillRate: 3,
    cleanupMethod: "max-tokens",
    cleanupInterval: 5 * 60, // 5 minutes
  }),
]);

router.handle("GET /limited/:resource")([(pr) => pr.end(StatusCode.OK)]);

let hookResults: Record<string, unknown> = {};

router.hook("DELETE /**")([
  (pr) => {
    hookResults["HOOK1 " + pr.url.pathname] = true;
  },
]);

router.hook("* /todo/**")([
  (pr) => {
    hookResults["HOOK2 " + pr.url.pathname] = true;
  },
]);

router.hook("* /todo/100")([
  (pr) => {
    hookResults["HOOK3 " + pr.url.pathname] = true;
  },
]);

router.handle("GET /todo/**")([(pr) => pr.end(StatusCode.OK)]);

router.handle("POST /todo/**")([(pr) => pr.end(StatusCode.Created)]);

router.handle("DELETE /todo/**")([(pr) => pr.end(StatusCode.OK)]);

Deno.test(async function Defined_Handler__OK() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/defined"),
    info
  );
  assertEquals(response.status, StatusCode.OK);
});

Deno.test(async function Undefined_Handler__NOT_FOUND() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/undefined"),
    info
  );
  assertEquals(response.status, StatusCode.NotFound);
});

Deno.test(async function Unimplemented_Handler__NO_CONTENT() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/unimplemented"),
    info
  );
  assertEquals(response.status, StatusCode.NoContent);
});

Deno.test(async function Case_Sensitivity() {
  {
    const response = await router.handleRequest(
      new Request("http://localhost:3000/case-SENSITIVe"),
      info
    );
    assertEquals(response.status, StatusCode.OK);
  }
  {
    const response = await router.handleRequest(
      new Request("http://localhost:3000/case-sensitive"),
      info
    );
    assertEquals(response.status, StatusCode.NotFound);
  }
  {
    const response = await router.handleRequest(
      new Request("http://localhost:3000/CASE-SENSITIVE"),
      info
    );
    assertEquals(response.status, StatusCode.NotFound);
  }
});

Deno.test(async function Parameterized_Paths___OK() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/"),
    info
  );
  assertEquals(response.status, StatusCode.OK);
  assertEquals(await response.text(), "home");
});

Deno.test(async function Parameterized_Paths_Home__OK() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/home"),
    info
  );
  assertEquals(response.status, StatusCode.OK);
  assertEquals(await response.text(), "home");
});

Deno.test(async function Parameterized_Paths_About__OK() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/about"),
    info
  );
  assertEquals(response.status, StatusCode.OK);
  assertEquals(await response.text(), "about");
});

const userRouter = new Router();

userRouter.handle("GET /")((pr) => pr.text("hello guest"));
userRouter.handle("GET /:user")((pr) => pr.text("hello " + pr.params.user));
userRouter.handle("DELETE /:id")((pr) => pr.text("bye user " + pr.params.id));

router.append("/api/user", userRouter);

Deno.test(async function Append_Router__OK() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/api/user"),
    info
  );
  assertEquals(response.status, StatusCode.OK);
  assertEquals(await response.text(), "hello guest");
});

Deno.test(async function Append_Router_GET_USER_PARAM__OK() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/api/user/Admin"),
    info
  );
  assertEquals(response.status, StatusCode.OK);
  assertEquals(await response.text(), "hello Admin");
});

Deno.test(async function Append_Router_DELETE_USER_PARAM__OK() {
  const response = await router.handleRequest(
    new Request("http://localhost:3000/api/user/u1234", { method: "delete" }),
    info
  );
  assertEquals(response.status, StatusCode.OK);
  assertEquals(await response.text(), "bye user u1234");
});

Deno.test(async function Hook_Glob__OK() {
  hookResults = {};
  const response = await router.handleRequest(
    new Request("http://localhost:3000/todo/103", { method: "DELETE" }),
    info
  );
  assertEquals(response.status, StatusCode.OK);
  assert(hookResults["HOOK1 /todo/103"]);
  assert(hookResults["HOOK2 /todo/103"]);
  assert(!hookResults["HOOK3 /todo/103"]);
  hookResults = {};
});

Deno.test(async function Hook_Direct__OK() {
  hookResults = {};
  const response = await router.handleRequest(
    new Request("http://localhost:3000/todo/100"),
    info
  );
  assertEquals(response.status, StatusCode.OK);
  assert(!hookResults["HOOK1 /todo/100"]);
  assert(hookResults["HOOK2 /todo/100"]);
  assert(hookResults["HOOK3 /todo/100"]);
  hookResults = {};
});

Deno.test(async function Filter_Access__Control_OK() {
  for (let i = 0; i < 3; i++) {
    const response = await router.handleRequest(
      new Request("http://localhost:3000/limited/resource-a"),
      info
    );
    assertEquals(response.status, StatusCode.OK);
    await delay(900);
  }
});

Deno.test(async function Filter_Access_Control__TooManyRequests() {
  // await delay(3000);
  for (let i = 0; i < 3; i++) {
    const response = await router.handleRequest(
      new Request("http://localhost:3000/limited/resource-b"),
      info
    );
    assertEquals(response.status, StatusCode.OK);
  }
  for (let i = 0; i < 4; i++) {
    const response = await router.handleRequest(
      new Request("http://localhost:3000/limited/resource-b"),
      info
    );
    assertEquals(response.status, StatusCode.TooManyRequests);
  }
  await delay(3300);
  for (let i = 0; i < 3; i++) {
    const response = await router.handleRequest(
      new Request("http://localhost:3000/limited/resource-b"),
      info
    );
    assertEquals(response.status, StatusCode.OK);
  }
});
