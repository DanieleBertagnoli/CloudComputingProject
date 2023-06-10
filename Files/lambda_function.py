import boto3
import json
from datetime import datetime, timedelta

def get_instances_exceeding_threshold(alarm_name):
    cloudwatch = boto3.client('cloudwatch')
    ec2 = boto3.resource('ec2')

    # Get the alarm information
    alarm = cloudwatch.describe_alarms(AlarmNames=[alarm_name])['MetricAlarms'][0]
    metric_name = alarm['MetricName']
    namespace = alarm['Namespace']
    dimensions = alarm['Dimensions']
    threshold = alarm['Threshold']
    comparison_operator = alarm['ComparisonOperator']

    # Get instances related to the alarm
    instances = []
    for dimension in dimensions:
        if dimension['Name'] == 'InstanceId':
            instances.append(ec2.Instance(dimension['Value']))
        else:
            if dimension['Name'] == 'AutoScalingGroupName':
                filters = [{'Name': 'tag:aws:autoscaling:groupName', 'Values': [dimension['Value']]}]
            else:
                filters = [{'Name': f"{dimension['Name'].lower()}", 'Values': [dimension['Value']]}]
            instances.extend([instance for instance in ec2.instances.filter(Filters=filters)])

    # Get the metric data for instances
    metric_data_queries = [
        {
            'Id': f"m{i}",
            'MetricStat': {
                'Metric': {
                    'Namespace': namespace,
                    'MetricName': metric_name,
                    'Dimensions': [{'Name': 'InstanceId', 'Value': instance.id}]
                },
                'Period': alarm['Period'],
                'Stat': alarm['Statistic']
            },
            'ReturnData': True
        }
        for i, instance in enumerate(instances)
    ]

    metric_data = cloudwatch.get_metric_data(
        MetricDataQueries=metric_data_queries,
        StartTime=datetime.utcnow() - timedelta(minutes=5),
        EndTime=datetime.utcnow()
    )['MetricDataResults']

    # Filter instances based on the alarm threshold
    instances_to_terminate = [
        instances[i]
        for i, metric in enumerate(metric_data)
        if metric['Values'] and (
            (comparison_operator == 'GreaterThanOrEqualToThreshold' and metric['Values'][-1] >= threshold) or
            (comparison_operator == 'GreaterThanThreshold' and metric['Values'][-1] > threshold) or
            (comparison_operator == 'LessThanOrEqualToThreshold' and metric['Values'][-1] <= threshold))
    ]

    return instances_to_terminate



def lambda_handler(event, context):
    cloudwatch = boto3.client('cloudwatch')
    ec2 = boto3.resource('ec2')
    
    sns_message = event['Records'][0]['Sns']['Message']
    alarm_name = json.loads(sns_message)['AlarmName']
    
    # Get the alarm information
    alarm = cloudwatch.describe_alarms(AlarmNames=[alarm_name])['MetricAlarms'][0]
    metric_name = alarm['MetricName']
    namespace = alarm['Namespace']
    dimensions = alarm['Dimensions']
    threshold = alarm['Threshold']
    comparison_operator = alarm['ComparisonOperator']

    instances_to_terminate = get_instances_exceeding_threshold(alarm_name)

    # Get all instances filtered by the same criteria as in get_instances_exceeding_threshold
    all_instances = []
    for dimension in dimensions:
        if dimension['Name'] == 'InstanceId':
            instance = ec2.Instance(dimension['Value'])
            if instance.state['Name'] == 'running':
                all_instances.append(instance)
        else:
            if dimension['Name'] == 'AutoScalingGroupName':
                filters = [{'Name': 'tag:aws:autoscaling:groupName', 'Values': [dimension['Value']]}]
            else:
                filters = [{'Name': f"{dimension['Name'].lower()}", 'Values': [dimension['Value']]}]
    
            # Add instance state filter for running instances
            filters.append({'Name': 'instance-state-name', 'Values': ['running']})
    
            all_instances.extend([instance for instance in ec2.instances.filter(Filters=filters)])
    
    # Calculate the number of instances that would remain after termination
    remaining_instance_count = len(all_instances) - len(instances_to_terminate)
    
    # If remaining instances would be less than 5, remove instances from the termination list
    if remaining_instance_count < 6:
        instances_to_terminate = instances_to_terminate[:-(6 - remaining_instance_count)]

    # Find the Auto Scaling group from the dimensions
    asg_name = None
    for dimension in dimensions:
        if dimension['Name'] == 'AutoScalingGroupName':
            asg_name = dimension['Value']
            break

    if asg_name:
        # Get the current desired capacity of the Auto Scaling group
        autoscaling = boto3.client('autoscaling')
        asg = autoscaling.describe_auto_scaling_groups(AutoScalingGroupNames=[asg_name])['AutoScalingGroups'][0]
        current_desired_capacity = asg['DesiredCapacity']

        # Calculate the new desired capacity after termination
        new_desired_capacity = current_desired_capacity - len(instances_to_terminate)

        # Ensure that the new desired capacity is not below the minimum desired capacity
        min_desired_capacity = asg['MinSize']
        if new_desired_capacity < min_desired_capacity:
            new_desired_capacity = min_desired_capacity

        # Update the desired capacity of the Auto Scaling group
        autoscaling.update_auto_scaling_group(
            AutoScalingGroupName=asg_name,
            DesiredCapacity=new_desired_capacity
        )

    for instance in instances_to_terminate:
        instance.terminate() 

    print(f"Terminated instances: {[instance.id for instance in instances_to_terminate]}")