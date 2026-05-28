import logging
from benchmarking.tasks import run_baseline_generation, run_user_benchmarking

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    print("=== Power User DNA & Benchmarking ===")
    
    print("\n[Step 1] Generating Gold Standard Baseline...")
    run_baseline_generation()
    
    print("\n[Step 2] Calculating User Feature Gaps & Habits...")
    run_user_benchmarking()
    
    print("\nDone! Check the `user_benchmarks` table for the results.")
