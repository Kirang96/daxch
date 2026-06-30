import asyncio
import time

import httpx


API = "http://localhost:8000/health"


async def run_once(client: httpx.AsyncClient) -> int:
    response = await client.get(API)
    return response.status_code


async def main(total_requests: int = 500, concurrency: int = 50) -> None:
    start = time.perf_counter()
    successes = 0

    semaphore = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(timeout=5) as client:
        async def wrapped() -> None:
            nonlocal successes
            async with semaphore:
                status = await run_once(client)
                if status == 200:
                    successes += 1

        await asyncio.gather(*[wrapped() for _ in range(total_requests)])

    elapsed = time.perf_counter() - start
    rps = total_requests / elapsed if elapsed else 0
    print(f"requests={total_requests} success={successes} elapsed={elapsed:.2f}s rps={rps:.2f}")


if __name__ == "__main__":
    asyncio.run(main())

