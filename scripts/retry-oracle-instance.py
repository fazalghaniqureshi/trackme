"""
Oracle Cloud Instance Auto-Retry Script
Alternates between VM.Standard.A1.Flex (ARM, 4 OCPU/24GB) and
VM.Standard.E2.1.Micro (x86, 1GB) every attempt until one opens up.

Run with:
  python retry-oracle-instance.py          (alternate both shapes)
  python retry-oracle-instance.py --micro  (only E2.1.Micro)
  python retry-oracle-instance.py --arm    (only A1.Flex)
"""

import oci, time, sys, datetime

# ── Config ────────────────────────────────────────────────────────────────────
TENANCY    = "ocid1.tenancy.oc1..aaaaaaaalwrokfjejjl4cbq6cnkuma7urx4aftfqrotydrmdh5auiepkmgqq"
AD         = "HfKs:AP-SINGAPORE-1-AD-1"
SUBNET     = "ocid1.subnet.oc1.ap-singapore-1.aaaaaaaaso2bezgaqno7euby57eegmrctrfgpiveobaszvsaawb5dpbfpnza"
SSH_KEY    = (
    "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCkramH24yjT5CZx1lOHn4Arjar"
    "UkeV55PM7pAUeZr+yrZhko/8f0Ws2d7WqYIgFaVbWKjGxrkV1WR9CUgETRwfInZ"
    "YeCwboaNwP2nPlg3EXsu2ryeqbgmqC0pY23snXS6xQFMn7mWJk40dQk4eX0uco+l"
    "vKkD1aLSPMCPhFCieYnJ90TPGLTNy+T7PoSR9kury3um3t1L4mvenaxzNpQm0QnA"
    "27Ux9ClZnJvRThImANqAVKboxGa0NjG24M7T3np1LLb54Qu6iVsigk1KyPQnIhFi"
    "9SMkpbtSvjrbaQEqa7yXmft8jxDvcbomh/9N+KM9fPuKtjt04b1XInQt9cRRL traccar-server"
)

# ARM (Always Free, 4 OCPU 24 GB)
ARM_IMAGE   = "ocid1.image.oc1.ap-singapore-1.aaaaaaaalx7qs4u3onszbfy3bc3nyesnb5adfwtbjltzpbsyspym7edlsbma"
MICRO_IMAGE = "ocid1.image.oc1.ap-singapore-1.aaaaaaaawgscu6wzqpatil2odersenhqtj5ayxnki57lae2p5hsm6ikwhz7q"

RETRY_SECS = 300   # 5 minutes between attempts
OCI_CONFIG = r"C:\trackme\.oci\config"
# ─────────────────────────────────────────────────────────────────────────────

use_micro  = "--micro" in sys.argv
use_arm    = "--arm"   in sys.argv
alternate  = not use_micro and not use_arm  # default: try both

def ts():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_public_ip(compute, network, instance_id):
    """Poll until instance has a public IP."""
    for _ in range(30):
        vnics = compute.list_vnic_attachments(TENANCY, instance_id=instance_id).data
        if vnics:
            vnic = network.get_vnic(vnics[0].vnic_id).data
            if vnic.public_ip:
                return vnic.public_ip
        time.sleep(10)
    return None

def launch_arm(client):
    details = oci.core.models.LaunchInstanceDetails(
        compartment_id=TENANCY,
        availability_domain=AD,
        shape="VM.Standard.A1.Flex",
        shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
            ocpus=4, memory_in_gbs=24
        ),
        source_details=oci.core.models.InstanceSourceViaImageDetails(
            image_id=ARM_IMAGE
        ),
        create_vnic_details=oci.core.models.CreateVnicDetails(
            subnet_id=SUBNET, assign_public_ip=True
        ),
        display_name="traccar-server",
        metadata={"ssh_authorized_keys": SSH_KEY}
    )
    return client.launch_instance(details)

def launch_micro(client):
    # Find latest Ubuntu 22.04 x86 image
    images = client.list_images(
        TENANCY,
        operating_system="Canonical Ubuntu",
        operating_system_version="22.04 Minimal",
        shape="VM.Standard.E2.1.Micro"
    ).data
    image_id = images[0].id if images else None
    if not image_id:
        # Fallback: use known aarch64 image won't work, find x86
        all_imgs = client.list_images(TENANCY, operating_system="Canonical Ubuntu").data
        x86 = [i for i in all_imgs if "22.04-Minimal-2026" in i.display_name and "aarch64" not in i.display_name]
        image_id = x86[0].id if x86 else None

    details = oci.core.models.LaunchInstanceDetails(
        compartment_id=TENANCY,
        availability_domain=AD,
        shape="VM.Standard.E2.1.Micro",
        source_details=oci.core.models.InstanceSourceViaImageDetails(
            image_id=image_id
        ),
        create_vnic_details=oci.core.models.CreateVnicDetails(
            subnet_id=SUBNET, assign_public_ip=True
        ),
        display_name="traccar-server",
        metadata={"ssh_authorized_keys": SSH_KEY}
    )
    return client.launch_instance(details)

config = oci.config.from_file(OCI_CONFIG)
compute = oci.core.ComputeClient(config)
network = oci.core.VirtualNetworkClient(config)

if alternate:
    shape_label = "A1.Flex (ARM) + E2.1.Micro (x86) alternating"
elif use_micro:
    shape_label = "VM.Standard.E2.1.Micro (x86, 1 GB)"
else:
    shape_label = "VM.Standard.A1.Flex (ARM 4 OCPU / 24 GB)"

print(f"{'='*55}")
print(f"  Oracle Cloud Instance Auto-Retry")
print(f"  Shape  : {shape_label}")
print(f"  Region : Singapore AD-1")
print(f"  Retry  : every {RETRY_SECS//60} minutes")
print(f"  Ctrl+C to stop")
print(f"{'='*55}\n")

attempt = 0
while True:
    attempt += 1
    # Alternate: odd attempts try ARM, even attempts try Micro
    try_micro = use_micro or (alternate and attempt % 2 == 0)
    shape_name = "E2.1.Micro" if try_micro else "A1.Flex"
    print(f"[{ts()}] Attempt #{attempt} [{shape_name}] — launching...", flush=True)
    try:
        resp = launch_micro(compute) if try_micro else launch_arm(compute)
        instance = resp.data
        print(f"\n{'='*55}")
        print(f"  SUCCESS! Instance created.")
        print(f"  ID    : {instance.id}")
        print(f"  State : {instance.lifecycle_state}")
        print(f"  Waiting for public IP...", flush=True)

        # Wait for RUNNING state
        oci.wait_until(compute, compute.get_instance(instance.id), "lifecycle_state", "RUNNING", max_wait_seconds=300)

        ip = get_public_ip(compute, network, instance.id)
        print(f"\n{'='*55}")
        print(f"  PUBLIC IP : {ip}")
        print(f"  SSH CMD   : ssh -i \"C:\\Users\\HP COMPUTER.S\\Downloads\\fazalghaniqureshi@gmail.com-2026-05-07T11_11_08.765Z.pem\" ubuntu@{ip}")
        print(f"{'='*55}")
        break

    except oci.exceptions.ServiceError as e:
        if "capacity" in e.message.lower() or "InternalError" in e.code:
            print(f"  -> Out of capacity. Waiting {RETRY_SECS//60} min before retry...", flush=True)
        elif "TooManyRequests" in e.code:
            print(f"  -> Rate limited by Oracle. Waiting {RETRY_SECS//60} min...", flush=True)
        elif "LimitExceeded" in e.code:
            print(f"  -> Limit exceeded — an instance may already exist. Check OCI Console.")
            break
        else:
            print(f"  -> Error: {e.code} — {e.message}")
            print(f"  Waiting {RETRY_SECS//60} min before retry...", flush=True)
        time.sleep(RETRY_SECS)
    except KeyboardInterrupt:
        print("\nStopped by user.")
        break
